import asyncio, sys
from bleak import BleakScanner, BleakClient
W="49535343-8841-43f4-a8d4-ecbe34729bb3"; N="49535343-1e4d-4bd9-ba61-23c647249616"
async def main():
    d = await BleakScanner.find_device_by_filter(lambda dev, adv: (adv.local_name or dev.name or "").startswith("HB-"), timeout=15)
    if not d: sys.exit("no printer")
    async with BleakClient(d, timeout=20) as c:
        got=[]
        await c.start_notify(N, lambda _, b: (got.append(bytes(b)), print("   <-", bytes(b).hex(" "), repr(bytes(b)), flush=True)))
        for name,h in [("GS g S paper query","1d6753"),("ESC ! ?","1b213f"),("FF","0c"),("GS FF","1d0c"),("LF","0a"),("~!T CRLF","7e21540d0a")]:
            n=len(got); print("->", name, flush=True)
            await c.write_gatt_char(W, bytes.fromhex(h), response=True); await asyncio.sleep(5)
            if any(b"LABEL" in g for g in got[n:]): print("FEED COMMAND:", name); break
asyncio.run(main())
