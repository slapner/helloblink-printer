import asyncio
from bleak import BleakScanner, BleakClient
W="49535343-8841-43f4-a8d4-ecbe34729bb3"; N1="49535343-1e4d-4bd9-ba61-23c647249616"; N2="49535343-aca3-481c-91ec-d85e28a60318"
Q=[("flush zeros", "00"*600),("ESC @","1b40"),
   ("phomemo fw 1f1107","1f1107"),("phomemo batt 1f1108","1f1108"),("phomemo serial 1f1109","1f1109"),("phomemo paper 1f1111","1f1111"),("phomemo cover 1f1112","1f1112"),("1f110e","1f110e"),("1f1138","1f1138"),
   ("GS I 1","1d4901"),("GS I 2","1d4902"),("GS I 65","1d4941"),("GS I 66","1d4942"),("GS I 67","1d4943"),("GS I 68","1d4944"),("GS I 69","1d4945"),
   ("GS a","1d61ff"),("ESC v","1b76"),("ESC u 0","1b7500"),("GS r 1","1d7201"),("GS r 2","1d7202"),("GS r 49","1d7231"),
   ("1b 28 41? batt 1b2b","1b2b"),("1e 47 03","1e4703"),("1f 70 01","1f7001"),("1f 20 00 batt","1f2000"),("1d 67 69","1d6769"),("1d 99","1d99"),
   ("10 06 01","100601"),("1c 2e?","1b2101"),
   ("TSPL ~!T","7e21540d0a"),("TSPL ESC!?","1b213f"),("TSPL ~!I","7e21490d0a"),("TSPL ~!F","7e21460d0a"),("CPCL ESC h","1b68"),("ZPL ~HS","7e48530d0a"),
   ("niimbot info","5555400108004aaaaa"[:0] or "555540010b4aaaaa"),("cat status","5178a30001000000ff"),("peri 10ff 3a?","10ff3001"),("BATTERY?\\r\\n","424154544552593f0d0a")]
async def main():
    d = await BleakScanner.find_device_by_name("HB-1267", timeout=15)
    async with BleakClient(d, timeout=20) as c:
        cb=lambda tag: (lambda _, data: print("   <-", tag, bytes(data).hex(" "), repr(bytes(data)), flush=True))
        await c.start_notify(N1, cb("1e4d")); await c.start_notify(N2, cb("aca3"))
        await asyncio.sleep(1)
        for name,h in Q:
            b=bytes.fromhex(h); print("->", name, flush=True)
            for i in range(0,len(b),120): await c.write_gatt_char(W, b[i:i+120], response=True)
            await asyncio.sleep(0.9)
        await asyncio.sleep(2)
asyncio.run(main())
