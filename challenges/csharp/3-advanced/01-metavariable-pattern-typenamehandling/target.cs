// Source: https://github.com/JamesNK/Newtonsoft.Json/blob/09bb545d72969ad7fb4ea07db0d5c34f4fc07877/Src/Newtonsoft.Json.Tests/Issues/Issue2735.cs  (lines 27-49, 151-163)
// Copyright (c) 2007 James Newton-King. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — license header dropped; the test body and helper classes replaced by `// ... (omitted)`; `#if` directives and the `DNXCORE50` `using` branch dropped; annotation comments added.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;
using System.Threading;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Tests.Documentation.Samples.Serializer;
using NUnit.Framework;

namespace Newtonsoft.Json.Tests.Issues
{
    [TestFixture]
    public class Issue2735 : TestFixtureBase
    {
        // ... (omitted)

        private JsonSerializerSettings DeserializeSettings(int maxDepth) => new JsonSerializerSettings()
        {
            // ok: unsafe-type-name-handling
            TypeNameHandling = TypeNameHandling.None,
            MaxDepth = maxDepth
        };

        private JsonSerializerSettings SerializeSettings(int maxDepth) => new JsonSerializerSettings()
        {
            // ruleid: unsafe-type-name-handling
            TypeNameHandling = TypeNameHandling.All,
            MaxDepth = maxDepth
        };
    }
}
