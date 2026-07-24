import { Platform } from "react-native";
import { saveNewsArticles, getNewsArticles } from "./DatabaseService";

const GNEWS_API_KEY = process.env.EXPO_PUBLIC_GNEWS_API_KEY || ""; // Set if available
const GNEWS_URL = "https://gnews.io/api/v4";

// High-quality mock news covering technology, AI, Android, Gaming, Cybersecurity, Kenyan, and World news
export const MOCK_NEWS = [
  {
    id: "news_ai_001",
    title: "OpenAI Announces GPT-5 with Human-Level Multi-Modal Reasoning",
    slug: "openai-gpt-5-announcement",
    summary: "OpenAI has officially unveiled its next-generation foundation model, GPT-5, promising unprecedented capabilities in complex planning, mathematics, and live video understanding.",
    fullContent: "OpenAI has officially announced GPT-5, the latest iteration of its flagship generative pre-trained transformer. According to internal reports, the model exhibits advanced reasoning capabilities that match or exceed human-level experts on standardized benchmarks in mathematics, coding, and logical synthesis.\n\nUnlike its predecessors, GPT-5 is natively multi-modal from inception, enabling it to process and generate real-time video, audio, and code instructions concurrently. The startup plans a gradual rollout starting next week for ChatGPT Plus subscribers, followed by developer API access.\n\nResearchers highlight that GPT-5 uses a mixture-of-experts (MoE) architecture with dynamic routing, allowing it to remain relatively cost-effective while delivering massive intelligence leaps.",
    heroImage: "https://images.unsplash.com/photo-1677442136019-21780efad99a?q=80&w=1000&auto=format&fit=crop",
    galleryImages: [
      "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop"
    ],
    publisher: "TechCrunch",
    publisherAvatar: "https://logo.clearbit.com/techcrunch.com" || "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?q=80&w=100&auto=format&fit=crop",
    category: "AI",
    tags: ["OpenAI", "GPT-5", "Artificial Intelligence", "Tech News"],
    publishedAt: "2 hours ago",
    readingTime: "3 min read",
    likes: 342,
    views: 1250,
    bookmarked: false,
    liked: false,
    featured: true,
    breaking: true,
    trending: true,
    timestamp: Date.now() - 7200000,
  },
  {
    id: "news_android_002",
    title: "Google Pixel 10 Leaks: Custom Tensor G5 Processor by TSMC",
    slug: "google-pixel-10-tensor-g5-tsmc",
    summary: "A leaked blueprint reveals that Google's upcoming Pixel 10 flagship will feature a fully custom-designed Tensor G5 chip, manufactured entirely by TSMC on a 3nm node.",
    fullContent: "For years, Google's Tensor chips have relied partially on Samsung's designs and foundry nodes. However, newly leaked documents reveal that Google is shifting entirely to TSMC for the Tensor G5 processor, which will debut inside the Pixel 10 and Pixel 10 Pro.\n\nThis shift to TSMC's 3nm fabrication is expected to bring substantial improvements in thermal efficiency, battery life, and peak processor speeds, addressing the primary complaints of Pixel users over the past few generations. The new processor will also feature dedicated Google TPU cores optimized for running large on-device neural networks without exhausting battery reserves.\n\nIndustry experts expect the launch in early autumn, marking a major milestone for Google's silicon autonomy.",
    heroImage: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=1000&auto=format&fit=crop",
    galleryImages: [
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=600&auto=format&fit=crop"
    ],
    publisher: "The Verge",
    publisherAvatar: "https://logo.clearbit.com/theverge.com" || "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=100&auto=format&fit=crop",
    category: "Android",
    tags: ["Google", "Pixel 10", "Tensor G5", "TSMC", "Android"],
    publishedAt: "4 hours ago",
    readingTime: "4 min read",
    likes: 198,
    views: 890,
    bookmarked: false,
    liked: false,
    featured: false,
    breaking: false,
    trending: true,
    timestamp: Date.now() - 14400000,
  },
  {
    id: "news_cyber_003",
    title: "Critical Zero-Day Exploit Patched in Global Wi-Fi Routers",
    slug: "critical-wifi-zero-day-exploit-patched",
    summary: "Security researchers have discovered a highly critical remote code execution vulnerability in multiple popular corporate and home Wi-Fi chipsets.",
    fullContent: "A team of cybersecurity experts has disclosed a critical zero-day vulnerability affecting millions of Wi-Fi routers worldwide. The exploit allows an unauthenticated attacker within range of the Wi-Fi signal to execute malicious code directly on the router's firmware, potentially intercepting all incoming internet traffic.\n\nRouter manufacturers have rushed patches to update firmware automatically, but older routers may require manual upgrades. Cybersecurity agencies are urging users to change default passwords, disable remote administration panels, and ensure their hardware remains updated.\n\n'This is one of the most severe wireless protocol exploits we've seen in recent years,' said the chief information officer of Cybersecurity Kenya.",
    heroImage: "https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=1000&auto=format&fit=crop",
    galleryImages: [],
    publisher: "Wired",
    publisherAvatar: "https://logo.clearbit.com/wired.com" || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop",
    category: "Cybersecurity",
    tags: ["Security", "Wi-Fi", "Zero-day", "Exploit", "Cybersecurity"],
    publishedAt: "6 hours ago",
    readingTime: "3 min read",
    likes: 85,
    views: 450,
    bookmarked: false,
    liked: false,
    featured: false,
    breaking: true,
    trending: false,
    timestamp: Date.now() - 21600000,
  },
  {
    id: "news_kenya_004",
    title: "Silicon Savannah: Nairobi Tech Hub Secures $450M in Venture Capital",
    slug: "nairobi-tech-hub-secures-funding",
    summary: "Kenya's tech sector continues its rapid expansion, securing $450 million in foreign direct investment to support climate-tech and fintech startups in East Africa.",
    fullContent: "Nairobi's bustling tech ecosystem, widely known as the 'Silicon Savannah', has reached a new funding peak this quarter. Startups in the region successfully raised a cumulative $450 million, led by international venture capital firms targeting green energy, micro-financing, and digital agricultural supply chains.\n\nLocal incubators highlight that Kenya's friendly regulatory frameworks and widespread mobile money adoption (M-Pesa) continue to serve as strong foundations for digital innovation. These funds are set to create thousands of direct tech-related jobs for local developers, engineers, and data scientists.\n\nWith new tech parks opening up on the outskirts of Nairobi, the country is solidify its role as Africa's premier technology gateway.",
    heroImage: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?q=80&w=1000&auto=format&fit=crop",
    galleryImages: [
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?q=80&w=600&auto=format&fit=crop"
    ],
    publisher: "Nairobi Tech Review",
    publisherAvatar: "https://logo.clearbit.com/nation.africa" || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=100&auto=format&fit=crop",
    category: "Kenya",
    tags: ["Silicon Savannah", "Nairobi", "Kenya Tech", "FinTech", "Funding"],
    publishedAt: "8 hours ago",
    readingTime: "5 min read",
    likes: 276,
    views: 1100,
    bookmarked: false,
    liked: false,
    featured: true,
    breaking: false,
    trending: true,
    timestamp: Date.now() - 28800000,
  },
  {
    id: "news_gaming_005",
    title: "GTA 6 New Gameplay Video Leaks, Confirming Extreme Detail",
    slug: "gta-6-gameplay-leaks-details",
    summary: "Rockstar Games has suffered another major breach as raw debug clips of GTA 6 circulate online, showcasing realistic weather physics and NPC interactions.",
    fullContent: "Grand Theft Auto 6 is arguably the most anticipated game of the decade, and security leaks continue to follow Rockstar Games. Fresh debug footage has leaked online, confirming the extreme detail built into the fictional state of Leonida.\n\nThe clips show dynamic water ripple animations, hair physics impacted by wind speeds, and NPCs reacting intelligently to ambient weather updates (such as taking cover under storefronts when rain begins). Rockstar has issued copyright strikes but hasn't denied the authenticity of the material.\n\nGaming analysts suggest the game is on track for its scheduled late 2025 release window.",
    heroImage: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=1000&auto=format&fit=crop",
    galleryImages: [],
    publisher: "IGN",
    publisherAvatar: "https://logo.clearbit.com/ign.com" || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&auto=format&fit=crop",
    category: "Gaming",
    tags: ["GTA 6", "Rockstar Games", "Leaks", "Gaming News"],
    publishedAt: "10 hours ago",
    readingTime: "3 min read",
    likes: 412,
    views: 1800,
    bookmarked: false,
    liked: false,
    featured: false,
    breaking: false,
    trending: true,
    timestamp: Date.now() - 36000000,
  },
  {
    id: "news_world_006",
    title: "Global Semiconductor Alliance Builds $50B European Mega-Fab",
    slug: "semiconductor-mega-fab-europe",
    summary: "A consortium of top global chipmakers has finalized a deal to build a massive $50 billion semiconductor fabrication plant in Munich to safeguard the microchip supply chain.",
    fullContent: "In an effort to secure technology supply lines against potential geopolitical friction, a global semiconductor consortium has agreed to build a state-of-the-art mega-fab facility in Munich, Germany. The project is backed by a combination of public grants and corporate investments totaling $50 billion.\n\nThe plant will focus on fabricating advanced silicon wafers used in electric vehicle hardware and AI cloud server networks. Construction is set to begin next year, bringing resilience to the European semiconductor supply chains and decreasing absolute dependency on East Asian silicon foundries.",
    heroImage: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1000&auto=format&fit=crop",
    galleryImages: [],
    publisher: "BBC News",
    publisherAvatar: "https://logo.clearbit.com/bbc.com" || "https://images.unsplash.com/photo-1607746882042-944635dfe10e?q=80&w=100&auto=format&fit=crop",
    category: "World",
    tags: ["Semiconductors", "Munich", "BBC News", "Supply Chain", "Global Trade"],
    publishedAt: "1 day ago",
    readingTime: "4 min read",
    likes: 110,
    views: 680,
    bookmarked: false,
    liked: false,
    featured: false,
    breaking: false,
    trending: false,
    timestamp: Date.now() - 86400000,
  }
];

// Helper to hash GNews title/url into unique alphanumeric ID
const hashCode = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).substring(0, 6);
};

// Calculate estimate reading time from content
const calculateReadingTime = (text) => {
  const words = (text || "").split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 180));
  return `${mins} min read`;
};

// Publisher avatar mappings
const getPublisherAvatar = (name) => {
  if (!name) return "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=100&auto=format&fit=crop";
  const domain = name.toLowerCase().replace(/\s+/g, "") + ".com";
  return `https://logo.clearbit.com/${domain}`;
};

export async function fetchLatestNews(category = "all") {
  const API_URL = typeof process !== 'undefined'
    ? (process.env?.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com")
    : "https://unity-3xc2.onrender.com";

  try {
    const catParam = category && category.toLowerCase() !== "all" ? `?category=${encodeURIComponent(category)}` : "";
    console.log(`[NewsService] Fetching news from backend for category: ${category}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${API_URL}/api/news${catParam}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Backend /api/news responded with status: ${response.status}`);
    }

    const data = await response.json();
    if (!data.news || !Array.isArray(data.news)) {
      throw new Error("Invalid response structure from backend /api/news");
    }

    const articles = data.news;
    console.log(`[NewsService] Received ${articles.length} articles from backend.`);

    // Save to local SQLite cache for offline fallback
    if (articles.length > 0) {
      await saveNewsArticles(articles);
    }

    return articles.length > 0 ? articles : MOCK_NEWS;

  } catch (error) {
    console.warn(`[NewsService] Backend fetch failed: ${error.message}. Falling back to local cache/mock.`);

    // Try local SQLite cache first
    try {
      const cached = await getNewsArticles();
      if (cached && cached.length > 0) {
        if (category.toLowerCase() !== "all") {
          const filtered = cached.filter(art =>
            art.category?.toLowerCase() === category.toLowerCase() ||
            (art.tags && art.tags.some(t => t.toLowerCase() === category.toLowerCase()))
          );
          if (filtered.length > 0) return filtered;
        }
        return cached;
      }
    } catch (dbErr) {
      console.warn("[NewsService] Local cache fallback failed:", dbErr.message);
    }

    // Final fallback: static mock news
    return MOCK_NEWS;
  }
}


