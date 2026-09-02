// Source: https://github.com/microsoft/PowerToys/blob/911e614e1cfb4ac5bec333fa1073a63bbeec4a99/src/modules/launcher/Plugins/Community.PowerToys.Run.Plugin.ValueGenerator/Generators/Hashing/HashRequest.cs  (lines 5-52)
// Copyright (c) Microsoft Corporation. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — members after the constructor replaced by `// ... (omitted)`; annotation comments added.
using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;

using Wox.Plugin.Logger;

namespace Community.PowerToys.Run.Plugin.ValueGenerator.Hashing
{
    public class HashRequest : IComputeRequest
    {
        public byte[] Result { get; set; }

        public bool IsSuccessful { get; set; }

        public string ErrorMessage { get; set; }

        public string Description
        {
            get
            {
                return $"{AlgorithmName}({Encoding.UTF8.GetString(DataToHash)})";
            }
        }

        public HashAlgorithmName AlgorithmName { get; set; }

        private byte[] DataToHash { get; set; }

        private static Dictionary<HashAlgorithmName, HashAlgorithm> _algorithms = new Dictionary<HashAlgorithmName, HashAlgorithm>()
        {
#pragma warning disable CA5351 // Do Not Use Broken Cryptographic Algorithms
            // ruleid: weak-hash-algorithm
            { HashAlgorithmName.MD5, MD5.Create() },
#pragma warning restore CA5351 // Do Not Use Broken Cryptographic Algorithms

#pragma warning disable CA5350 // Do Not Use Weak Cryptographic Algorithms
            // ruleid: weak-hash-algorithm
            { HashAlgorithmName.SHA1, SHA1.Create() },
#pragma warning restore CA5350 // Do Not Use Weak Cryptographic Algorithms
            // ok: weak-hash-algorithm
            { HashAlgorithmName.SHA256, SHA256.Create() },
            // ok: weak-hash-algorithm
            { HashAlgorithmName.SHA384, SHA384.Create() },
            // ok: weak-hash-algorithm
            { HashAlgorithmName.SHA512, SHA512.Create() },
        };

        public HashRequest(HashAlgorithmName algorithmName, byte[] dataToHash)
        {
            AlgorithmName = algorithmName;
            DataToHash = dataToHash ?? throw new ArgumentNullException(nameof(dataToHash));
        }

        // ... (omitted)
    }
}
