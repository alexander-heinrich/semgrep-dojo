// Source: https://github.com/dotnet/aspnetcore/blob/70f2905ceb6b28f398e80eb9c5f746c1d888dfe4/src/Identity/samples/IdentitySample.Mvc/Controllers/AccountController.cs  (lines 5-560)
// Copyright (c) .NET Foundation and Contributors. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — file-scoped namespace turned into a block; unrelated members and the `#region`/`#endregion` directives replaced by `// ... (omitted)`; annotation comments added.
using IdentitySample.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace IdentitySample.Controllers
{
    [Authorize]
    public class AccountController : Controller
    {
        // ... (omitted)

        //
        // GET: /Account/Login
        // ruleid: public-action
        [HttpGet]
        [AllowAnonymous]
        public IActionResult Login(string returnUrl = null)
        {
            ViewData["ReturnUrl"] = returnUrl;
            return View();
        }

        //
        // POST: /Account/LogOff
        // ruleid: public-action
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> LogOff()
        {
            await _signInManager.SignOutAsync();
            _logger.LogInformation(4, "User logged out.");
            return RedirectToAction(nameof(HomeController.Index), "Home");
        }

        // ... (omitted)

        //
        // GET: /Account/ForgotPasswordConfirmation
        // ruleid: public-action
        [HttpGet]
        [AllowAnonymous]
        public IActionResult ForgotPasswordConfirmation()
        {
            return View();
        }

        //
        // GET: /Account/ResetPassword
        // ruleid: public-action
        [HttpGet]
        [AllowAnonymous]
        public IActionResult ResetPassword(string code = null)
        {
            return code == null ? View("Error") : View();
        }

        // ... (omitted)

        // ok: public-action
        private void AddErrors(IdentityResult result)
        {
            foreach (var error in result.Errors)
            {
                ModelState.AddModelError(string.Empty, error.Description);
            }
        }

        // ok: public-action
        private Task<ApplicationUser> GetCurrentUserAsync()
        {
            return _userManager.GetUserAsync(HttpContext.User);
        }

        // ok: public-action
        private IActionResult RedirectToLocal(string returnUrl)
        {
            if (Url.IsLocalUrl(returnUrl))
            {
                return Redirect(returnUrl);
            }
            else
            {
                return RedirectToAction(nameof(HomeController.Index), "Home");
            }
        }
    }
}
