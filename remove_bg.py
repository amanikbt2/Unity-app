from PIL import Image
import sys

try:
    img = Image.open('assets/android-icon-monochrome.png')
    img = img.convert("RGBA")
    datas = img.getdata()
    newData = []
    
    # We want to remove the white background AND convert the black icon to white.
    # A correct Android Notification icon must be a white shape on a transparent background.
    for item in datas:
        # If it's very close to white (background), make it transparent
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            newData.append((255, 255, 255, 0))
        # If it's a shadow or antialiasing, make it white but keep its relative alpha
        # Actually, simpler: if it's NOT the white background, force it to be solid white
        # with its current opacity (or full opacity if it was black)
        else:
            # item[3] is the alpha. Let's just make the pixel white and keep it fully opaque,
            # or if it had some transparency, keep it.
            newData.append((255, 255, 255, item[3]))
            
    img.putdata(newData)
    img.save('assets/android-icon-monochrome.png', "PNG")
    print("Successfully fixed monochrome notification icon!")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
