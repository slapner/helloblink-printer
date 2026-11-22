import asyncio
from bleak import BleakScanner, BleakClient
async def main():
    d = await BleakScanner.find_device_by_name("HB-1267", timeout=15)
    print("device", d)
    async with BleakClient(d, timeout=20) as c:
        print("connected", c.is_connected, "mtu", c.mtu_size)
        for s in c.services:
            print("SVC", s.uuid, s.description)
            for ch in s.characteristics:
                val = None
                if "read" in ch.properties:
                    try: val = bytes(await c.read_gatt_char(ch))
                    except Exception as e: val = "ERR %s" % e
                print("   CH", ch.uuid, ch.properties, "maxwrite", ch.max_write_without_response_size, val)
asyncio.run(main())
