"""Reproduce the private asset substitution with fake credentials (CI only)."""
import sys, struct, zlib, zipfile
from pathlib import Path

source = Path(sys.argv[1])
output = Path(sys.argv[2])
entry_name = "assets/direct_auth.dat"
old = b"ZZZZZZZZZZZZZ\nZZZZZZZZZZZZZZZZ\n"
fake_user = b"FAKE.ACCESS01"
fake_pass = b"FAKE.PASSWORD001"
new = fake_user + b"\n" + fake_pass + b"\n"
assert len(new) == len(old)
b = bytearray(source.read_bytes())
with zipfile.ZipFile(source) as z:
    info = z.getinfo(entry_name)
    assert info.compress_type == zipfile.ZIP_STORED
    assert z.read(entry_name) == old
    local = info.header_offset
    assert b[local:local + 4] == b"PK\x03\x04"
    nlen, xlen = struct.unpack_from("<HH", b, local + 26)
    data = local + 30 + nlen + xlen
    assert b[data:data+len(old)] == old
    assert info.file_size == len(old)
    b[data:data+len(new)] = new
    crc = zlib.crc32(new) & 0xffffffff
    struct.pack_into("<I", b, local+14, crc)
    flags = struct.unpack_from("<H",b,local+6)[0]
    if flags & 8:
        dd=data+info.compress_size
        if b[dd:dd+4] == b"PK\x07\x08": dd+=4
        struct.pack_into("<I",b,dd,crc)
    eocd = b.rfind(b"PK\x05\x06")
    cen = struct.unpack_from("<I",b,eocd+16)[0]
    while b[cen:cen+4] == b"PK\x01\x02":
        nl,el,cl=struct.unpack_from("<HHH",b,cen+28)
        filename=bytes(b[cen+46:cen+46+nl]).decode("utf-8")
        if filename == entry_name:
            assert struct.unpack_from("<I",b,cen+42)[0] == local
            struct.pack_into("<I",b,cen+16,crc)
            break
        cen += 46+nl+el+cl
    else: raise RuntimeError("Central directory entry not found")
output.write_bytes(b)
with zipfile.ZipFile(output) as z: assert z.testzip() is None
print("Fake signed asset is valid and contains no real secrets")
