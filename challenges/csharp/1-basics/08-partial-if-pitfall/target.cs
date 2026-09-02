// Source: https://github.com/OrchardCMS/OrchardCore/blob/7418cecfe38deed1398becb6f3520c4fa7786b6e/src/OrchardCore.Modules/OrchardCore.Users/Controllers/EmailConfirmationController.cs  (lines 1-121)
// Copyright (c) .NET Foundation. Licensed under BSD-3-Clause. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — file-scoped namespace turned into a block; fields, constructor and ConfirmEmailSent omitted; annotation comments added.
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace OrchardCore.Users.Controllers
{
    public sealed class EmailConfirmationController : Controller
    {
        // ... (omitted)

        [AllowAnonymous]
        public async Task<IActionResult> ConfirmEmail(string userId, string code)
        {
            // ok: null-or-empty-guard
            if (userId == null || code == null)
            {
                return NotFound();
            }

            var user = await _userManager.FindByIdAsync(userId);

            // ok: null-or-empty-guard
            if (user == null)
            {
                return NotFound();
            }

            var result = await _userManager.ConfirmEmailAsync(user, code);

            if (result.Succeeded)
            {
                var userContext = new UserConfirmContext(user) { ConfirmationType = UserConfirmationType.Email };
                await _userEventHandlers.InvokeAsync((handler, context) => handler.ConfirmedAsync(userContext), userContext, _logger);

                return View();
            }

            return NotFound();
        }

        // ... (omitted)

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> SendVerificationEmail(string id = null, string returnUrl = null)
        {
            var currentUserId = HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);

            // ruleid: null-or-empty-guard
            if (string.IsNullOrEmpty(id))
            {
                id = currentUserId;
            }

            // ruleid: null-or-empty-guard
            if (string.IsNullOrEmpty(id))
            {
                return NotFound();
            }

            // Allow users to verify their own email without the 'ManageUsers' permission.
            // ok: null-or-empty-guard
            if (id != currentUserId && !await _authorizationService.AuthorizeAsync(User, UsersPermissions.ManageUsers))
            {
                return Forbid();
            }

            var user = await _userManager.FindByIdAsync(id) as User;

            if (user == null)
            {
                return NotFound();
            }

            await _userEmailService.SendEmailConfirmationAsync(user);

            await _notifier.SuccessAsync(H["Verification email sent."]);

            // ok: null-or-empty-guard
            if (!string.IsNullOrWhiteSpace(returnUrl) && Url.IsLocalUrl(returnUrl))
            {
                return Redirect(returnUrl);
            }

            return RedirectToAction(nameof(AdminController.Index), typeof(AdminController).ControllerName());
        }
    }
}
