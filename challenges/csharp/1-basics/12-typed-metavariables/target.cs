// Source: https://github.com/umbraco/Umbraco-CMS/blob/32877ebf09fcc8150e09e616b2cb67cc2e45b64f/src/Umbraco.Core/HashGenerator.cs  (lines 1-80)
// Copyright (c) 2005-present Umbraco. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — file-scoped namespace turned into a block; fields, constructor, XML doc comments and later members replaced by `// ... (omitted)`; annotation comments added.
using System.Security.Cryptography;
using System.Text;

namespace Umbraco.Cms.Core
{
    public class HashGenerator : DisposableObjectSlim
    {
        // ... (omitted)

        // ok: write-string
        public void AddInt(int i) => _writer.Write(i);

        // ok: write-string
        public void AddLong(long i) => _writer.Write(i);

        // ok: write-string
        public void AddObject(object o) => _writer.Write(o);

        // ok: write-string
        public void AddDateTime(DateTime d) => _writer.Write(d.Ticks);

        public void AddString(string s)
        {
            if (s != null)
            {
                // ruleid: write-string
                _writer.Write(s);
            }
        }

        public void AddCaseInsensitiveString(string s)
        {
            if (s != null)
            {
                // ok: write-string
                _writer.Write(s.ToUpperInvariant());
            }
        }

        // ... (omitted)
    }
}
