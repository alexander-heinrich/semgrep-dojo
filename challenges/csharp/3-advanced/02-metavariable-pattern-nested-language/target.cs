// Source: https://github.com/CodeThreat/IssueBlot.NET/blob/06f33f75ec5f3e36594f32e5413d8d4fd64282b0/src/NETMVCBlot/Controllers/CodeInjectionController.cs  (lines 1-23)
// Copyright (c) 2023 CodeThreat. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: no
using RazorEngine;
using RazorEngine.Templating;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace NETMVCBlot.Controllers
{
    public class CodeInjectionController : Controller
    {
        public ActionResult Index()
        {
            string template = "Hello @Model.Name, welcome to RazorEngine!";
            // CTSECISSUE:MVCViewCodeInjection
            // ruleid: razor-template-model-access
            Engine.Razor.RunCompile(template, "key", null, new { Name = "World" });

            return View();
        }

    }
}
