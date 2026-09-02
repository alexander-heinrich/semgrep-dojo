// Source: https://github.com/HooliCorp/vulnerable_net_core/blob/a20ecb5fcac9edaf1732729dc2bc3b2e81894552/vulnerable_asp_net_core/Controllers/SL.cs  (lines 1-27, 67-100, 317-342)
// Copyright (c) HooliCorp. Licensed under Apache-2.0. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — unrelated actions and fields replaced by `// ... (omitted)`, a TODO comment removed from InsecureDeserialization; annotation comment added.
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

                Show("Results of your request: " + string.Empty);

                foreach (XmlNode xn in xmlDoc)
                {
                    if (xn.Name == "user") Show("Results of your request: " + _javaScriptEncoder.Encode(xn.InnerText));
                }
            }

            return View();
        }

        [HttpGet]
        public IActionResult InsecureDeserialization()
        {
            var xml = RequestUtils.GetIfDefined(Request, "xml");

            if (xml.Length == 0)
                return View();

            var ser_xml = new XmlSerializer(typeof(Executable));
            try
            {
                // ruleid: request-to-deserialize
                var sreader = new StringReader(xml);
                var xread = XmlReader.Create(sreader);
                var exe = (Executable)ser_xml.Deserialize(xread);
                Show("Request results: \'" + _javaScriptEncoder.Encode(exe.Run()) + "\'");
            }
            catch (Exception)
            {
                Show("Request results: \'\'");
            }

            return View();
        }
    }
}
