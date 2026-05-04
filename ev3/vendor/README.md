# Offline Python Wheels

Place `websockets` wheel files here for offline installation on EV3.

## How to download (run on a machine with internet):

```bash
pip download websockets==11.0.3 --dest . --python-version 3.9 --platform linux_armv7l --only-binary :all:
# If no binary available, download source and install via pip:
pip download websockets==11.0.3 --dest . --no-binary :all:
```

Then `ev3-setup.sh` will `scp` this directory to the EV3 and install offline.
