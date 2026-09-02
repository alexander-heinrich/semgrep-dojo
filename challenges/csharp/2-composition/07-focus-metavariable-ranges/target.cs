// Source: https://github.com/appsecco/dvcsharp-api/blob/76c1de3c9d8d9c2e8ec0b50abe3b198a4330d7fc/Controllers/ProductsController.cs  (lines 1-92)
// Copyright (c) 2022 Appsecco Ltd. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — the Get, Post and Search actions replaced by `// ... (omitted)`; annotation comments added.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.IO;
using System.Xml;
using System.Xml.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using dvcsharp_core_api.Models;
using dvcsharp_core_api.Data;

namespace dvcsharp_core_api
{
   [Route("api/[controller]")]
   public class ProductsController : Controller
   {
      private readonly GenericDataContext _context;

      public ProductsController(GenericDataContext context)
      {
         _context = context;
      }

      // ... (omitted)

      [HttpGet("export")]
      public void Export()
      {
         XmlRootAttribute root = new XmlRootAttribute("Entities");
         XmlSerializer serializer = new XmlSerializer(typeof(Product[]), root);

         Response.ContentType = "application/xml";
         serializer.Serialize(HttpContext.Response.Body, _context.Products.ToArray());
      }

      // ... (omitted)

      [HttpPost("import")]
      public IActionResult Import()
      {
         XmlReader reader = XmlReader.Create(HttpContext.Request.Body);
         XmlRootAttribute root = new XmlRootAttribute("Entities");
         XmlSerializer serializer = new XmlSerializer(typeof(Product[]), root);

         // ruleid: deserialize-argument
         var entities = (Product[]) serializer.Deserialize(reader);
         reader.Close();

         return Ok(entities);
      }
   }
}
