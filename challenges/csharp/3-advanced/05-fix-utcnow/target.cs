// Source: https://github.com/appsecco/dvcsharp-api/blob/76c1de3c9d8d9c2e8ec0b50abe3b198a4330d7fc/Models/User.cs  (lines 1-69)
// Copyright (c) 2022 Appsecco Ltd. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — constants, properties and later members replaced by `// ... (omitted)`; annotation comments added.
using System;
using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Text;
using System.Security.Claims;
using dvcsharp_core_api.Data;

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
            // ruleid: datetime-now
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
