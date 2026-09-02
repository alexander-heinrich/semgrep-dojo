// Source: https://github.com/appsecco/dvcsharp-api/blob/76c1de3c9d8d9c2e8ec0b50abe3b198a4330d7fc/Models/User.cs  (lines 1-18)
// Copyright (c) 2022 Appsecco Ltd. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — members after the constants replaced by `// ... (omitted)`; annotation comments added.
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
      // ok: high-entropy-constant
      public const string RoleUser = "User";
      // ok: high-entropy-constant
      public const string RoleSupport = "Support";
      // ok: high-entropy-constant
      public const string RoleAdministrator = "Administrator";
      // ruleid: high-entropy-constant
      public const string TokenSecret = "f449a71cff1d56a122c84fa478c16af9075e5b4b8527787b56580773242e40ce";

      // ... (omitted)
   }
}
