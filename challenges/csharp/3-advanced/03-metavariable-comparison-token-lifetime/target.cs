// Source: https://github.com/appsecco/dvcsharp-api/blob/76c1de3c9d8d9c2e8ec0b50abe3b198a4330d7fc/Models/User.cs  (lines 1, 6-7, 10-13, 40-69, 102-103) and https://github.com/CodeThreat/IssueBlot.NET/blob/06f33f75ec5f3e36594f32e5413d8d4fd64282b0/src/NETMVCBlot/Controllers/AccountController.cs  (lines 8-10, 16-20, 24-33, 500-501)
// Copyright (c) 2022 Appsecco Ltd. (MIT); Copyright (c) 2023 CodeThreat (MIT). See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — two files combined; unrelated members replaced by `// ... (omitted)`; unused using directives dropped; annotation comments added.
using System;
using System.Security.Claims;
using System.Text;
using System.Web;
using System.Web.Http.Cors;
using System.Web.Mvc;

namespace dvcsharp_core_api.Models
{
   public class User
   {
      // ... (omitted)

      public string createAccessToken()
      {
         string secret = TokenSecret;
         string issuer = "http://localhost.local/";
         string audience = "http://localhost.local/";

         var claims = new[]
         {
            new Claim("name", this.email),
            new Claim("role", this.role)
         };

         var signingKey = new Microsoft.IdentityModel.
            Tokens.SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));

         var creds = new Microsoft.IdentityModel.
            Tokens.SigningCredentials(signingKey, 
               Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256);

         var token = new System.IdentityModel.Tokens.Jwt.JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            // ruleid: long-lived-expiry
            expires: DateTime.Now.AddMinutes(30),
            claims: claims,
            signingCredentials: creds
         );

         return (new System.IdentityModel.Tokens.
            Jwt.JwtSecurityTokenHandler().WriteToken(token));
      }

      // ... (omitted)
   }
}

namespace NETMVCBlot.Controllers
{
    [Authorize]
    public class AccountController : Controller
    {
        // ... (omitted)

        [EnableCors("*", null, "GET")]
        [HttpPost]
        // CTSECISSUE: Inadequate Input Validation - MVC/Web API
        public void Post(Person person)
        {
           
            HttpCookie cookie = new HttpCookie("emailCookie", person.Name);
            // CTSECISSUE: Using Persistent Cookie
            // ok: long-lived-expiry
            cookie.Expires = DateTime.Now.AddMinutes(10); 
        }

        // ... (omitted)
    }
}
