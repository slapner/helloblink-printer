import asyncio, sys, time
from bleak import BleakScanner, BleakClient
W="49535343-8841-43f4-a8d4-ecbe34729bb3"; N="49535343-1e4d-4bd9-ba61-23c647249616"
HDR=bytes([0x1d,0x76,0x30,0,48,0,1,0])
async def main():
    d = await BleakScanner.find_device_by_filter(lambda dev, adv: (adv.local_name or dev.name or "").startswith("HB-"), timeout=15)
    if not d: sys.exit("no printer")
    async with BleakClient(d, timeout=20) as c:
        sent=0
        def cb(_, b): print("   <- after", sent, "rows:", bytes(b).hex(" "), repr(bytes(b)), flush=True)
        await c.start_notify(N, cb)
        for i in range(900):
            await c.write_gatt_char(W, HDR+bytes(48), response=True); sent+=1
        await asyncio.sleep(6)
        print("done", sent)
asyncio.run(main())
