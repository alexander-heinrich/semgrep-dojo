// Source: https://github.com/CodeThreat/IssueBlot.NET/blob/06f33f75ec5f3e36594f32e5413d8d4fd64282b0/src/NETMVCBlot/Controllers/SQLInjController.cs  (lines 1-53)
// Copyright (c) 2023 CodeThreat. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: no
using System;
using System.Collections.Generic;
using System.Data.Entity;
using System.Data.Objects;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using Microsoft.SharePoint.Search.Query;
using Microsoft.SharePoint.Client;
using Microsoft.SharePoint;

namespace NETMVCBlot.Controllers
{
    public class SQLInjController : Controller
    {
        public ActionResult Index(string input)
        {
            using (ObjectContext studentContext = new ObjectContext("name=StudentEntities"))
            {
                // CTSECISSUE: SQLInjection
                // ruleid: sql-concat-input
                studentContext.CreateQuery<Student>("select * from students " + input);

                // CTSECISSUE: SQLInjection
                // ruleid: sql-concat-input
                studentContext.ExecuteStoreCommand("select * from students " + input);

                // CTSECISSUE: SQLInjection
                // ruleid: sql-concat-input
                studentContext.ExecuteStoreQuery<Student>("select * from students " + input);

                // CTSECISSUE: SQLInjection
                // ruleid: sql-concat-input
                studentContext.ExecuteStoreQuery<Student>("select * from students " + input, "", MergeOption.AppendOnly);
            }

            FullTextSqlQuery myQuery = new FullTextSqlQuery(SPContext.Current.Site)
            {
                // CTSECISSUE: SQLInjection
                QueryText = "SELECT Path FROM SCOPE() WHERE  \"SCOPE\" = '" + input + "'",
                ResultTypes = ResultType.RelevantResults

            };

            return View();
        }
    }

    class SchoolContext : DbContext
    {
        public DbSet<Student> Students { get; set; }
    }

    class Student
    {
    }
}
