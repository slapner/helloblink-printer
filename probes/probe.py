import asyncio, sys
from bleak import BleakScanner, BleakClient
W="49535343-8841-43f4-a8d4-ecbe34729bb3"; N1="49535343-1e4d-4bd9-ba61-23c647249616"; N2="49535343-aca3-481c-91ec-d85e28a60318"
Q=[("model","10ff20f0"),("fw","10ff20f1"),("serial","10ff20f2"),("battery","10ff50f1"),("status","10ff40"),("density","10ff11"),("allinfo","10ff70"),
   ("escpos-status1","100401"),("escpos-status4","100404"),("gs-I-model","1d4943"),("gs-r","1d7201")]
async def main():
    d = await BleakScanner.find_device_by_name("HB-1267", timeout=15)
    async with BleakClient(d, timeout=20) as c:
        def cb(tag):
            return lambda _, data: print("   <-", tag, bytes(data).hex(" "), repr(bytes(data)), flush=True)
        await c.start_notify(N1, cb("1e4d"))
        try: await c.start_notify(N2, cb("aca3"))
        except Exception as e: print("N2 err", e)
        await asyncio.sleep(2.5)
        for name,h in Q:
            print("->", name, h, flush=True)
            await c.write_gatt_char(W, bytes.fromhex(h), response=False)
            await asyncio.sleep(1.2)
        await asyncio.sleep(2)
asyncio.run(main())
