// Source: https://github.com/restsharp/RestSharp/blob/0ed7b0a6b64ab4b9838c2c0cb76a1808facebe09/src/RestSharp/Extensions/StringExtensions.cs  (lines 15-42)
// Copyright (c) 2009-2020 John Sheehan, Andrew Young, Alexey Zimarev and RestSharp community. Licensed under Apache-2.0. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — the extension methods after the regex fields replaced by `// ... (omitted)`; annotation comments added.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;

namespace RestSharp.Extensions
{
    public static class StringExtensions
    {
        // ok: regex-repeated-group
        static readonly Regex DateRegex    = new Regex(@"\\?/Date\((-?\d+)(-|\+)?([0-9]{4})?\)\\?/");
        // ruleid: regex-repeated-group
        static readonly Regex NewDateRegex = new Regex(@"newDate\((-?\d+)*\)");

        static readonly Regex IsUpperCaseRegex = new Regex(@"^[A-Z]+$");

        static readonly Regex AddUnderscoresRegex1 = new Regex(@"[-\s]");
        static readonly Regex AddUnderscoresRegex2 = new Regex(@"([a-z\d])([A-Z])");
        static readonly Regex AddUnderscoresRegex3 = new Regex(@"([A-Z]+)([A-Z][a-z])");

        static readonly Regex AddDashesRegex1 = new Regex(@"[\s]");
        static readonly Regex AddDashesRegex2 = new Regex(@"([a-z\d])([A-Z])");
        static readonly Regex AddDashesRegex3 = new Regex(@"([A-Z]+)([A-Z][a-z])");

        static readonly Regex AddSpacesRegex1 = new Regex(@"[-\s]");
        static readonly Regex AddSpacesRegex2 = new Regex(@"([a-z\d])([A-Z])");
        static readonly Regex AddSpacesRegex3 = new Regex(@"([A-Z]+)([A-Z][a-z])");

        // ... (omitted)
    }
}
