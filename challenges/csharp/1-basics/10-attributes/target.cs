// Source: https://github.com/appsecco/dvcsharp-api/blob/76c1de3c9d8d9c2e8ec0b50abe3b198a4330d7fc/Controllers/ProductsController.cs  (lines 1-92)
// Copyright (c) 2022 Appsecco Ltd. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — method bodies shortened with `// ... (omitted)`; annotation comments added.
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

      // ok: post-action
      [HttpGet]
      public IEnumerable<Product> Get()
      {
         return _context.Products.ToList();
      }

      // ruleid: post-action
      [HttpPost]
      public IActionResult Post([FromBody] Product product)
      {
         if(!ModelState.IsValid)
         {
            return BadRequest(ModelState);
         }

         // ... (omitted)

         _context.Products.Add(product);
         _context.SaveChanges();

         return Ok(product);
      }

      // ok: post-action
      [HttpGet("export")]
      public void Export()
      {
         XmlRootAttribute root = new XmlRootAttribute("Entities");
         XmlSerializer serializer = new XmlSerializer(typeof(Product[]), root);

         Response.ContentType = "application/xml";
         serializer.Serialize(HttpContext.Response.Body, _context.Products.ToArray());
      }

      // ok: post-action
      [HttpGet("search")]
      public IActionResult Search(string keyword)
      {
         // ... (omitted)

         var query = $"SELECT * From Products WHERE name LIKE '%{keyword}%' OR description LIKE '%{keyword}%'";
         var products = _context.Products
            .FromSql(query)
            .ToList();

         return Ok(products);
      }

      // ruleid: post-action
      [HttpPost("import")]
      public IActionResult Import()
      {
         XmlReader reader = XmlReader.Create(HttpContext.Request.Body);
         XmlRootAttribute root = new XmlRootAttribute("Entities");
         XmlSerializer serializer = new XmlSerializer(typeof(Product[]), root);

         var entities = (Product[]) serializer.Deserialize(reader);
         reader.Close();

         return Ok(entities);
      }
   }
}
