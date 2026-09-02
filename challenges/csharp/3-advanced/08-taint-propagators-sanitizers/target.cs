// Source: https://github.com/HooliCorp/vulnerable_net_core/blob/a20ecb5fcac9edaf1732729dc2bc3b2e81894552/vulnerable_asp_net_core/Controllers/SL.cs  (lines 1-27, 38-100)
// Copyright (c) HooliCorp. Licensed under Apache-2.0. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — unrelated actions and fields replaced by `// ... (omitted)`; annotation comments added.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using vulnerable_asp_net_core.Models;
using System.Data.SQLite;
using System.IO;
using System.Net;
using System.Text.Encodings.Web;
using System.Xml;
using System.Xml.Serialization;
using vulnerable_asp_net_core.Utils;

namespace vulnerable_asp_net_core.Controllers
{
    public class SL : Controller
    {
        // ... (omitted)

        public void Show(String s)
        {
            _log4net.Info($"Returning to view {s}");
            @ViewData["result"] = HtmlEncoder.Default.Encode(s);
        }

        [HttpGet]
        public IActionResult SQLInjection()
        {
            string name = RequestUtils.GetIfDefined(Request, "name");
            string pw = RequestUtils.GetIfDefined(Request, "pw");
            string res = "";

            if (name.Length > 0)
            {
                var command = new SQLiteCommand($"SELECT * FROM users WHERE name = '{name}' and pw = '{pw}'",
                    DatabaseUtils._con);
                using (var reader = command.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        res += reader["name"] + "";
                    }
                }

                // ok: untrusted-xml-content
                Show("Successfully logged in as " + _javaScriptEncoder.Encode(res));
            }


            if (res.Length == 0)
                // ok: untrusted-xml-content
                Show("Please login by providing a valid username and password");

            return View();
        }

        [HttpGet]
        public IActionResult XXE()
        {
            string xml = RequestUtils.GetIfDefined(Request, "xml");

            if (xml.Length <= 0)
            {
                @ViewData["result"] = "upload your request";
            }
            else
            {
                var resolver = new XmlUrlResolver();
                resolver.Credentials = CredentialCache.DefaultCredentials;
                var xmlDoc = new XmlDocument();
                xmlDoc.XmlResolver = resolver;

                try
                {
                    xmlDoc.LoadXml(xml);
                }
                catch (Exception)
                {
                }

                // ok: untrusted-xml-content
                Show("Results of your request: " + string.Empty);

                // ruleid: untrusted-xml-content
                foreach (XmlNode xn in xmlDoc)
                {
                    // ok: untrusted-xml-content
                    if (xn.Name == "user") Show("Results of your request: " + _javaScriptEncoder.Encode(xn.InnerText));
                }
            }

            return View();
        }
    }
}
