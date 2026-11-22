import asyncio
from bleak import BleakScanner
async def main():
    found = await BleakScanner.discover(timeout=12.0, return_adv=True)
    for addr,(d,adv) in sorted(found.items(), key=lambda kv: -kv[1][1].rssi):
        print(adv.rssi, repr(d.name), repr(adv.local_name), addr, adv.service_uuids, {k:v.hex() for k,v in adv.manufacturer_data.items()})
asyncio.run(main())
