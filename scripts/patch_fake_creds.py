"""Reproduce private DEX string patch with public dummy values for Android startup QA only."""
import sys, struct, hashlib, zlib, zipfile
from pathlib import Path

source = Path(sys.argv[1])
destination = Path(sys.argv[2])
fake_user = b"FAKE.ACCESS01"
fake_pass = b"FAKE.PASSWORD001"
assert len(fake_user) == 13
assert len(fake_pass) == 16

with zipfile.ZipFile(source) as existing, zipfile.ZipFile(destination, "w") as output:
    for entry in existing.infolist():
        data = existing.read(entry.filename)
        if entry.filename == "classes3.dex":
            assert data.count(b"Z" * 16) == 1
            data = data.replace(b"Z" * 16, fake_pass).replace(b"Z" * 13, fake_user)
            data = bytearray(data)
            data[12:32] = hashlib.sha1(data[32:]).digest()
            data[8:12] = struct.pack("<I", zlib.adler32(data[12:]) & 0xffffffff)
        info = zipfile.ZipInfo(entry.filename, entry.date_time)
        info.compress_type = entry.compress_type
        info.create_system = entry.create_system
        info.external_attr = entry.external_attr
        info.internal_attr = entry.internal_attr
        info.extra = b""
        output.writestr(info, data)
print("Fake credentials patch completed. No real credentials were used.")
