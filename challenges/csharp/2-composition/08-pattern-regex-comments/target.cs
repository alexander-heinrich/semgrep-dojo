// Source: https://github.com/CodeThreat/IssueBlot.NET/blob/06f33f75ec5f3e36594f32e5413d8d4fd64282b0/src/NETMVCBlot/Controllers/SQLInjController.cs  (lines 12-43) and https://github.com/CodeThreat/IssueBlot.NET/blob/06f33f75ec5f3e36594f32e5413d8d4fd64282b0/src/NETMVCBlot/Controllers/CodeInjectionController.cs  (lines 9-23)
// Copyright (c) 2023 CodeThreat. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — two files combined; using directives and helper classes replaced by `// ... (omitted)`; annotation comments added.
// ... (omitted)

namespace NETMVCBlot.Controllers
{
    public class SQLInjController : Controller
    {
        public ActionResult Index(string input)
        {
            using (ObjectContext studentContext = new ObjectContext("name=StudentEntities"))
            {
                // ruleid: ctsec-sqli-marker
                // CTSECISSUE: SQLInjection
                studentContext.CreateQuery<Student>("select * from students " + input);

                // ruleid: ctsec-sqli-marker
                // CTSECISSUE: SQLInjection
                studentContext.ExecuteStoreCommand("select * from students " + input);

                // ruleid: ctsec-sqli-marker
                // CTSECISSUE: SQLInjection
                studentContext.ExecuteStoreQuery<Student>("select * from students " + input);

                // ruleid: ctsec-sqli-marker
                // CTSECISSUE: SQLInjection
                studentContext.ExecuteStoreQuery<Student>("select * from students " + input, "", MergeOption.AppendOnly);
            }

            FullTextSqlQuery myQuery = new FullTextSqlQuery(SPContext.Current.Site)
            {
                // ruleid: ctsec-sqli-marker
                // CTSECISSUE: SQLInjection
                QueryText = "SELECT Path FROM SCOPE() WHERE  \"SCOPE\" = '" + input + "'",
                ResultTypes = ResultType.RelevantResults

            };

            return View();
        }
    }

    // ... (omitted)
    public class CodeInjectionController : Controller
    {
        public ActionResult Index()
        {
            string template = "Hello @Model.Name, welcome to RazorEngine!";
            // ok: ctsec-sqli-marker
            // CTSECISSUE:MVCViewCodeInjection
            Engine.Razor.RunCompile(template, "key", null, new { Name = "World" });

            return View();
        }

    }
}
