// Source: https://github.com/dotnet/aspnetcore/blob/6fd0a4c337354cff8a0ba9cdc81a8f57e0f010ca/src/Security/samples/Cookies/Controllers/AccountController.cs  (lines 4-54, 61-66) and https://github.com/Soham7-dev/AspGoat/blob/db3153f5dae036a9d67e12be22548299855c6b40/Controllers/HomeController.cs  (lines 18, 21-22, 159-168, 444)
// Copyright (c) .NET Foundation and Contributors (MIT); Copyright (c) 2025 Soham Das (MIT). See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — two files combined; file-scoped namespace turned into a block; unrelated members replaced by `// ... (omitted)`; the class-level `[Authorize]` attribute in HomeController dropped; annotation comments added.
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;

namespace AuthSamples.Cookies.Controllers
{
    public class AccountController : Controller
    {
        // ... (omitted)

        [HttpPost]
        public async Task<IActionResult> Login(string userName, string password, string returnUrl = null)
        {
            ViewData["ReturnUrl"] = returnUrl;

            // Normally Identity handles sign in, but you can do it directly
            if (ValidateLogin(userName, password))
            {
                var claims = new List<Claim>
                    {
                        new Claim("user", userName),
                        new Claim("role", "Member")
                    };

                await HttpContext.SignInAsync(new ClaimsPrincipal(new ClaimsIdentity(claims, "Cookies", "user", "role")));

                if (Url.IsLocalUrl(returnUrl))
                {
                    // ok: open-redirect
                    return Redirect(returnUrl);
                }
                else
                {
                    // ok: open-redirect
                    return Redirect("/");
                }
            }

            return View();
        }

        // ... (omitted)

        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync();
            // ok: open-redirect
            return Redirect("/");
        }
    }
}

namespace AspGoat.Controllers
{
    public class HomeController : Controller
    {
        // ... (omitted)

        [HttpGet]
        public IActionResult OpenRedirect(string returnUrl)
        {
            if (returnUrl != null)
            {
                // ruleid: open-redirect
                return Redirect(returnUrl);
            }

            return View();
        }

        // ... (omitted)
    }
}
