// Source: https://github.com/ExcelDataReader/ExcelDataReader/blob/f7d7fd54b5bf79217e0369857b6e682f5948e67a/src/ExcelDataReader/Core/OfficeCrypto/CryptoHelpers.cs  (lines 1-19, 46-58)
// Copyright (c) 2014 ExcelDataReader. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — helper methods between and after the two switch expressions replaced by `// ... (omitted)`; annotation comments added.
using System.Security.Cryptography;

namespace ExcelDataReader.Core.OfficeCrypto;

internal static class CryptoHelpers
{
    public static HashAlgorithm Create(HashIdentifier hashAlgorithm) => hashAlgorithm switch
    {
        HashIdentifier.SHA512 => SHA512.Create(),
        HashIdentifier.SHA384 => SHA384.Create(),
        HashIdentifier.SHA256 => SHA256.Create(),
// ok: broken-crypto-suppressed
#pragma warning disable CA5350 // Do Not Use Weak Cryptographic Algorithms
        HashIdentifier.SHA1 => SHA1.Create(),
#pragma warning restore CA5350 // Do Not Use Weak Cryptographic Algorithms
// ruleid: broken-crypto-suppressed
#pragma warning disable CA5351 // Do Not Use Broken Cryptographic Algorithms
        HashIdentifier.MD5 => MD5.Create(),
#pragma warning restore CA5351 // Do Not Use Broken Cryptographic Algorithms
        _ => throw new InvalidOperationException("Unsupported hash algorithm"),
    };
    // ... (omitted)
    public static SymmetricAlgorithm CreateCipher(CipherIdentifier identifier, int keySize, int blockSize, CipherMode mode) => identifier switch
    {
        CipherIdentifier.RC4 => new RC4Managed(),
// ok: broken-crypto-suppressed
#pragma warning disable CA5350 // Do Not Use Weak Cryptographic Algorithms
        CipherIdentifier.DES3 => InitCipher(TripleDES.Create(), keySize, blockSize, mode),
#pragma warning restore CA5350 // Do Not Use Weak Cryptographic Algorithms
// ruleid: broken-crypto-suppressed
#pragma warning disable CA5351 // Do Not Use Broken Cryptographic Algorithms
        CipherIdentifier.RC2 => InitCipher(RC2.Create(), keySize, blockSize, mode),
        CipherIdentifier.DES => InitCipher(DES.Create(), keySize, blockSize, mode),
#pragma warning restore CA5351 // Do Not Use Broken Cryptographic Algorithms
        CipherIdentifier.AES => InitCipher(Aes.Create(), keySize, blockSize, mode),
        _ => throw new InvalidOperationException("Unsupported encryption method: " + identifier.ToString()),
    };

    // ... (omitted)
}
