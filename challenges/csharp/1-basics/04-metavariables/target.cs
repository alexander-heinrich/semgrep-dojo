// Source: https://github.com/dotnet/aspnetcore/blob/6fd0a4c337354cff8a0ba9cdc81a8f57e0f010ca/src/Security/samples/Cookies/Controllers/AccountController.cs  (lines 4-66)
// Copyright (c) .NET Foundation and Contributors. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — file-scoped namespace turned into a block; annotation comments added.
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;

namespace AuthSamples.Cookies.Controllers
{
    public class AccountController : Controller
    {
        [HttpGet]
        public IActionResult Login(string returnUrl = null)
        {
            ViewData["ReturnUrl"] = returnUrl;
            return View();
        }

        private bool ValidateLogin(string userName, string password)
        {
            // For this sample, all logins are successful.
            return true;
        }

        [HttpPost]
        public async Task<IActionResult> Login(string userName, string password, string returnUrl = null)
        {
            ViewData["ReturnUrl"] = returnUrl;

            // Normally Identity handles sign in, but you can do it directly
            if (ValidateLogin(userName, password))
            {
                var claims = new List<Claim>
                    {
                        // ok: claim-literal-value
                        new Claim("user", userName),
                        // ruleid: claim-literal-value
                        new Claim("role", "Member")
                    };

                await HttpContext.SignInAsync(new ClaimsPrincipal(new ClaimsIdentity(claims, "Cookies", "user", "role")));

                if (Url.IsLocalUrl(returnUrl))
                {
                    return Redirect(returnUrl);
                }
                else
                {
                    return Redirect("/");
                }
            }

            return View();
        }

        public IActionResult AccessDenied(string returnUrl = null)
        {
            return View();
        }

        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync();
            return Redirect("/");
        }
    }
}
