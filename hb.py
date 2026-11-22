"""HelloBlink (HB-xxxx) BLE printer: ESC/POS over ISSC transparent UART.
usage: hb.py status | hb.py test [width_px] | hb.py image FILE [width_px] | hb.py text "words" [width_px]"""
import asyncio, sys
from bleak import BleakScanner, BleakClient
W="49535343-8841-43f4-a8d4-ecbe34729bb3"; N="49535343-1e4d-4bd9-ba61-23c647249616"

def raster(img, width):
    from PIL import Image
    img = img.convert("L")
    if img.width != width:
        img = img.resize((width, max(1, round(img.height*width/img.width))))
    img = img.convert("1")  # Floyd-Steinberg dither
    wb = (width+7)//8; h = img.height; px = img.load()
    data = bytearray(wb*h)
    for y in range(h):
        for x in range(width):
            if px[x,y] == 0: data[y*wb + x//8] |= 0x80 >> (x%8)
    return bytes([0x1d,0x76,0x30,0, wb%256, wb//256, h%256, h//256]) + bytes(data)

def test_img(width):
    from PIL import Image, ImageDraw
    im = Image.new("L", (width, 72), 255); d = ImageDraw.Draw(im)
    d.text((4,2), "Hello from Mac", fill=0)
    for x in range(0, width, 10):
        d.line((x, 40 if x%50 else 30, x, 55), fill=0)
        if x%50 == 0: d.text((x+2, 58), str(x), fill=0)
    d.line((0,55,width-1,55), fill=0); d.rectangle((0,0,width-1,71), outline=0)
    return im

def text_img(s, width):
    from PIL import Image, ImageDraw, ImageFont
    try: f = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 40)
    except Exception: f = ImageFont.load_default()
    box = ImageDraw.Draw(Image.new("L",(1,1))).multiline_textbbox((0,0), s, font=f)
    im = Image.new("L", (width, box[3]+16), 255)
    ImageDraw.Draw(im).multiline_text(((width-box[2])//2, 8), s, font=f, fill=0, align="center")
    return im

async def main():
    cmd = sys.argv[1]
    d = await BleakScanner.find_device_by_filter(lambda dev, adv: (adv.local_name or dev.name or "").startswith("HB-"), timeout=15)
    if not d: sys.exit("no HB- printer found (is it on, and not connected to the phone?)")
    async with BleakClient(d, timeout=20) as c:
        got = []
        await c.start_notify(N, lambda _, b: (got.append(bytes(b)), print("   <-", bytes(b).hex(" "), repr(bytes(b)), flush=True)))
        await c.start_notify("49535343-aca3-481c-91ec-d85e28a60318", lambda _, b: print("   <- ctl", bytes(b).hex(" "), flush=True))
        async def q(name, h):
            print("->", name, flush=True); await c.write_gatt_char(W, bytes.fromhex(h), response=False); await asyncio.sleep(0.8)
        for n in (1,2,3,4): await q("DLE EOT %d" % n, "1004%02x" % n)
        if cmd == "status": return
        from PIL import Image
        if cmd == "test": width = int(sys.argv[2]) if len(sys.argv)>2 else 384; im = test_img(width)
        elif cmd == "image": width = int(sys.argv[3]) if len(sys.argv)>3 else 384; im = Image.open(sys.argv[2])
        elif cmd == "text": width = int(sys.argv[3]) if len(sys.argv)>3 else 384; im = text_img(sys.argv[2], width)
        r = raster(im, width); wb = (width+7)//8; body = r[8:]
        rows = [body[i:i+wb] for i in range(0, len(body), wb)]
        feed = int(sys.argv[sys.argv.index("--feed")+1]) if "--feed" in sys.argv else 0
        rows += [bytes(wb)] * feed
        print("sending", len(rows), "rows, one raster command per row", flush=True)
        for row in rows:  # the official app sends GS v 0 with height 1 for every row
            await c.write_gatt_char(W, bytes([0x1d,0x76,0x30,0x00, wb%256, wb//256, 0x01, 0x00]) + row, response=True)
        await asyncio.sleep(10)
        await q("DLE EOT 1", "100401")
asyncio.run(main())
