import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';
import { displayMessageNotification } from './NotificationService';
import { chatWithAI, translateText } from './TranslationService';
import { saveChat, updateContactLastMessageTime } from './DatabaseService';

const QUEUE_KEY = '@message_queue';

class MessageQueueService {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.isConnected = true;
    this.listeners = new Set();
    this.init();
  }

  async init() {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load message queue', e);
    }

    NetInfo.addEventListener(state => {
      const wasConnected = this.isConnected;
      this.isConnected = state.isConnected;
      
      if (!wasConnected && this.isConnected) {
        this.processQueue();
      }
    });

    // Request notification permissions
    Notifications.requestPermissionsAsync();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }

  async saveQueue() {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      console.warn('Failed to save message queue', e);
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(event) {
    this.listeners.forEach(cb => cb(event));
  }

  /**
   * Add a message to the offline queue
   * @param {Object} job - { id, type: 'text' | 'ai', payload: { ... }, partnerName }
   */
  async enqueue(job) {
    this.queue.push(job);
    await this.saveQueue();
    this.processQueue();
  }

  async processQueue() {
    console.log(`[MessageQueue] processQueue started. isProcessing=${this.isProcessing}, isConnected=${this.isConnected}, queueLength=${this.queue.length}`);
    if (this.isProcessing || this.queue.length === 0) {
      console.log(`[MessageQueue] processQueue aborted.`);
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const job = this.queue[0];
      let success = false;
      let replyText = null;

      let aiReply = undefined;
      
      job.attempts = (job.attempts || 0) + 1;

      try {
        if (job.type === 'ai') {
          const translatedUserText = await translateText(job.payload.text, job.payload.partnerLang);
          
          if (job.userMsgId) {
             this.notifyListeners({
                isUserUpdate: true,
                userMsgId: job.userMsgId,
                transText: translatedUserText
             });
             try {
                await saveChat({
                  id: job.userMsgId,
                  partner_id: job.partnerId,
                  text: job.payload.text,
                  trans_text: translatedUserText,
                  sender: "user",
                  orig_lang: `${job.userLangName || "User"} (Original)`,
                  trans_lang: `${job.partnerLangName || "Partner"} (Translated)`,
                  timestamp: Date.now(),
                });
             } catch (e) { console.error(e); }
          }
          
          aiReply = await chatWithAI(translatedUserText, job.payload.history || [], job.payload.targetLang);
          replyText = await translateText(aiReply, job.payload.userLang);
          success = true;
        } else if (job.type === 'translate') {
          replyText = await translateText(job.payload.text, job.payload.targetLang);
          success = true;
        }
      } catch (err) {
        console.error('Queue job failed:', err);
        if (err.message.toLowerCase().includes('network') || err.message.toLowerCase().includes('gateway') || err.message.toLowerCase().includes('failed to fetch')) {
           if (job.attempts > 3) {
             console.warn("Job failed 3 times, dropping from queue.");
             replyText = "Network Error - Message failed.";
             success = true;
           } else {
             break; 
           }
        } else {
           replyText = "Failed to send message.";
           success = true; 
        }
      }

      // Prevent infinite loops for corrupted jobs
      if (!success && job.type !== 'ai' && job.type !== 'translate') {
        console.warn("Corrupted job detected, dropping from queue.");
        success = true;
      }

      if (success) {
        // Remove from queue
        this.queue.shift();
        await this.saveQueue();

        // Save partner message to SQLite database
        if (replyText && job.partnerId && job.partnerMsgId) {
          try {
            await saveChat({
              id: job.partnerMsgId,
              partner_id: job.partnerId,
              text: typeof aiReply !== 'undefined' ? aiReply : replyText,
              trans_text: replyText,
              sender: "partner",
              orig_lang: `${job.partnerLangName || "AI"} (Original)`,
              trans_lang: `${job.userLangName || "User"} (Translated)`,
              timestamp: Date.now(),
            });
            await updateContactLastMessageTime(job.partnerId, Date.now());
          } catch (e) {
            console.error("Queue failed to save to SQLite:", e);
          }
        }

        // Notify listeners (UI) that a job completed
        this.notifyListeners({ 
          jobId: job.id, 
          partnerMsgId: job.partnerMsgId, 
          success: true, 
          replyText,
          partnerSpokenText: typeof aiReply !== 'undefined' ? aiReply : replyText 
        });

        // Trigger background notification if we got a valid reply
        if (replyText && job.partnerName) {
           await displayMessageNotification(job.partnerName, replyText, job.partnerAvatarUrl);
        }
      }
    }

    this.isProcessing = false;
  }
}

export const messageQueue = new MessageQueueService();
