import asyncio
from bleak import BleakScanner, BleakClient
W="49535343-8841-43f4-a8d4-ecbe34729bb3"; N1="49535343-1e4d-4bd9-ba61-23c647249616"
Q=[("10 06 01","100601"),("1b 21 01","1b2101"),("~!T crlf","7e21540d0a"),("1b 21 3f","1b213f"),("1b 21 3f again","1b213f"),("1b 21 53","1b2153"),("1b 21 4f","1b214f"),
   ("1e 47 01","1e4701"),("1e 47 02","1e4702"),("1e 47 04","1e4704"),("1e 47 05","1e4705"),("1e 47 00","1e4700"),
   ("1d 67 66","1d6766"),("1d 67 68","1d6768"),("1d 67 6a","1d676a"),("1d 67 31","1d6731"),("1d 67 61","1d6761"),
   ("1e 42 01?","1e4201"),("1e 46 01?","1e4601"),("1e 48 01?","1e4801"),("1e 04 01","1e0401")]
async def main():
    d = await BleakScanner.find_device_by_name("HB-1267", timeout=15)
    async with BleakClient(d, timeout=20) as c:
        await c.start_notify(N1, lambda _, data: print("   <-", bytes(data).hex(" "), repr(bytes(data)), flush=True))
        await asyncio.sleep(1)
        for name,h in Q:
            print("->", name, flush=True)
            await c.write_gatt_char(W, bytes.fromhex(h), response=True); await asyncio.sleep(1.5)
        await asyncio.sleep(2)
asyncio.run(main())
