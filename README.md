# HelloBlink sticker printer from a computer

Talks to a HelloBlink sticker printer (advertises over Bluetooth LE as `HB-xxxx`) without the phone app.

## Web app

```
cd web && python3 -m http.server 8377
```

Open http://localhost:8377 in Chrome or Edge (Safari and Firefox have no Web Bluetooth). Click "Connect printer", pick `HB-…`, then Print.
Artwork comes from one of three tabs: Photo, Text, or Draw (freehand with a mouse, finger or pen).
The printer takes one connection at a time: close the phone app first.

## Command line

```
./venv/bin/python hb.py status
./venv/bin/python hb.py image FILE 384 [--feed ROWS]
./venv/bin/python hb.py text "words" 384 [--feed ROWS]
```

## What is known about the printer

- USB is power only. Nothing enumerates on the Mac.
- BLE service `49535343-fe7d-4ae5-8fa9-9fafd205e455` (Microchip transparent UART). Write `…8841…`, notify `…1e4d…`.
- Head: 384 dots (48 bytes per row). Firmware reports `HV=H1.0,SV=V1.01,DPI=384`.
- Printing: one raster command per row, `1d 76 30 00 30 00 01 00` + 48 bytes. 1 = black, most significant bit is the left dot.
  A multi-row `GS v 0` block prints only its first row.
- The official app (Flutter, `com.efercro.helloblink` 2.0.1) sends a 384×384 image, Floyd–Steinberg dithered.
  Its encoder (`hello_blink_escpos.dart`) adds two constant byte lists before the rows and one after. Their bytes are not yet known.
- Queries that answer: `10 04 01..04` (status), `1d 72 01`, `1e 47 03` (versions, battery mV), `1d 67 53` (paper, replies `err:<n>.`),
  `1d 67 68` (`printer:HB.`), `1d 67 61` / `1d 67 69` (id).
- `LABELOK` has been seen twice as an unsolicited reply after a sticker fed out. What triggers it is not known.

## Open questions

- The command that advances to the next sticker (the app's trailer).
- Where on the sticker row 0 lands, and how many rows one sticker pitch is.

`apk/` (local only, not in this repository) holds the app package and static-analysis scripts. `probes/` holds the Bluetooth experiments.
