// Source: https://github.com/umbraco/Umbraco-CMS/blob/32877ebf09fcc8150e09e616b2cb67cc2e45b64f/src/Umbraco.Core/Services/MemberService.cs  (lines 1-19, 229-240, 253-263)
// Copyright (c) 2005-present Umbraco. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — only two CreateMember overloads kept; fields, constructor, XML doc comments and other members replaced by `// ... (omitted)`; annotation comments added.
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Models.Membership;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Persistence;
using Umbraco.Cms.Core.Persistence.Querying;
using Umbraco.Cms.Core.Persistence.Repositories;
using Umbraco.Cms.Core.Scoping;
using Umbraco.Extensions;

namespace Umbraco.Cms.Core.Services
{
    public class MemberService : RepositoryService, IMemberService
    {
        // ... (omitted)

        public IMember CreateMember(string username, string email, string name, string memberTypeAlias)
        {
            IMemberType memberType = GetMemberType(memberTypeAlias);
            if (memberType == null)
            {
                throw new ArgumentException("No member type with that alias.", nameof(memberTypeAlias));
            }

            // ruleid: culture-sensitive-lowercase
            var member = new Member(name, email.ToLower().Trim(), username, memberType, 0);

            return member;
        }

        public IMember CreateMember(string username, string email, string name, IMemberType memberType)
        {
            if (memberType == null)
            {
                throw new ArgumentNullException(nameof(memberType));
            }

            // ruleid: culture-sensitive-lowercase
            var member = new Member(name, email.ToLower().Trim(), username, memberType, 0);

            return member;
        }

        // ... (omitted)
    }
}
