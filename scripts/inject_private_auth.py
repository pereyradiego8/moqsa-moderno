"""Insert a private SOAP access asset into an unsigned Android APK for release builds.

The 31-byte access secret comes from MOQSA_SOAP_AUTH_B64. Never commit
actual credentials or log the decoded value. This must run BEFORE apksigner.
"""
import base64
import os
from pathlib import Path
import struct
import sys
from zipfile import ZipFile
import zlib

NAME = "assets/direct_auth.dat"
PLACEHOLDER = b"ZZZZZZZZZZZZZ\nZZZZZZZZZZZZZZZZ\n"


def patch(source, destination):
    encoded = os.environ.get("MOQSA_SOAP_AUTH_B64", "")
    if not encoded:
        raise SystemExit("Falta MOQSA_SOAP_AUTH_B64; no se genera una APK distribuible")
    try:
        private = base64.b64decode(encoded, validate=True)
    except (ValueError, base64.binascii.Error):
        raise SystemExit("MOQSA_SOAP_AUTH_B64 no es base64 válido")
    lines = private.splitlines()
    if (len(private) != len(PLACEHOLDER) or len(lines) != 2 or
            [len(x) for x in lines] != [13, 16] or
            private == PLACEHOLDER or b"\x00" in private):
        raise SystemExit("El acceso SOAP privado no tiene el formato esperado")

    apk = bytearray(Path(source).read_bytes())
    with ZipFile(source) as z:
        entry = z.getinfo(NAME)
        if entry.compress_type != 0 or z.read(NAME) != PLACEHOLDER:
            raise SystemExit("La plantilla SOAP no coincide")
        local = entry.header_offset
        if apk[local:local+4] != b"PK\x03\x04":
            raise SystemExit("Estructura del APK inválida")
        n, e = struct.unpack_from("<HH", apk, local+26)
        offset = local+30+n+e
        if apk[offset:offset+len(PLACEHOLDER)] != PLACEHOLDER:
            raise SystemExit("Posición del acceso incorrecta")
        apk[offset:offset+len(private)] = private
        crc = zlib.crc32(private) & 0xffffffff
        struct.pack_into("<I", apk, local+14, crc)
        if struct.unpack_from("<H", apk, local+6)[0] & 8:
            dd = offset + entry.compress_size
            if apk[dd:dd+4] == b"PK\x07\x08":
                dd += 4
            struct.pack_into("<I", apk, dd, crc)
        end = apk.rfind(b"PK\x05\x06")
        if end < 0:
            raise SystemExit("No hay directorio central")
        cursor = struct.unpack_from("<I", apk, end+16)[0]
        found = False
        while apk[cursor:cursor+4] == b"PK\x01\x02":
            nl, el, cl = struct.unpack_from("<HHH", apk, cursor+28)
            name = bytes(apk[cursor+46:cursor+46+nl]).decode("utf-8")
            if name == NAME:
                if struct.unpack_from("<I", apk, cursor+42)[0] != local:
                    raise SystemExit("Desajuste de directorio")
                struct.pack_into("<I", apk, cursor+16, crc)
                found = True
                break
            cursor += 46+nl+el+cl
        if not found:
            raise SystemExit("Recurso no encontrado en directorio central")

    Path(destination).write_bytes(apk)
    with ZipFile(destination) as z:
        if z.testzip() is not None or z.read(NAME) != private:
            Path(destination).unlink(missing_ok=True)
            raise SystemExit("El recurso SOAP resultante no pasó la validación")
    print("Acceso privado insertado y estructura ZIP verificada sin exponer secretos")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Uso: inject_private_auth.py base.apk output.apk")
    patch(*sys.argv[1:])
