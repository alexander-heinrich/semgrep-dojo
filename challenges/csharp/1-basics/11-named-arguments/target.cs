// Source: https://github.com/DapperLib/Dapper/blob/6d48ef664acc7298c649e2d449d903b3360d5a90/tests/Dapper.Tests/ProcedureTests.cs  (lines 1-8, 15-16, 64-93, 115-131, 144-158, 345-346)
// Copyright (c) Stack Exchange, Inc. Licensed under Apache-2.0. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: no
using System;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Dapper.Tests
{
    // ... (omitted)
    public abstract class ProcedureTests<TProvider> : TestBase<TProvider> where TProvider : DatabaseProvider
    {
        [Fact]
        public void TestIssue17648290()
        {
            var p = new DynamicParameters();
            const int code = 1, getMessageControlId = 2;
            p.Add("@Code", code);
            p.Add("@MessageControlID", getMessageControlId);
            p.Add("@SuccessCode", dbType: DbType.Int32, direction: ParameterDirection.Output);
            // ok: stored-procedure-call
            p.Add("@ErrorDescription", dbType: DbType.String, direction: ParameterDirection.Output, size: 255);
            // ok: stored-procedure-call
            connection.Execute(
            @"CREATE PROCEDURE #up_MessageProcessed_get
                @Code varchar(10),
                @MessageControlID varchar(22),
                @SuccessCode int OUTPUT,
                @ErrorDescription varchar(255) OUTPUT
            AS
            BEGIN
                Select 2 as MessageProcessID, 38349348 as StartNum, 3874900 as EndNum, GETDATE() as StartDate, GETDATE() as EndDate
                SET @SuccessCode = 0
                SET @ErrorDescription = 'Completed successfully'
            END");
            // ruleid: stored-procedure-call
            var result = connection.Query(sql: "#up_MessageProcessed_get", param: p, commandType: CommandType.StoredProcedure);
            var row = result.Single();
            Assert.Equal(2, (int)row.MessageProcessID);
            Assert.Equal(38349348, (int)row.StartNum);
            Assert.Equal(3874900, (int)row.EndNum);
            DateTime startDate = row.StartDate, endDate = row.EndDate;
            Assert.Equal(0, p.Get<int>("SuccessCode"));
            Assert.Equal("Completed successfully", p.Get<string>("ErrorDescription"));
        }

        // ... (omitted)

        [Fact]
        public void SO24605346_ProcsAndStrings()
        {
            connection.Execute(
            @"create proc #GetPracticeRebateOrderByInvoiceNumber 
                @TaxInvoiceNumber nvarchar(20) 
            as
                select @TaxInvoiceNumber as [fTaxInvoiceNumber]");
            const string InvoiceNumber = "INV0000000028PPN";
            // ruleid: stored-procedure-call
            var result = connection.Query<PracticeRebateOrders>("#GetPracticeRebateOrderByInvoiceNumber", new
            {
                TaxInvoiceNumber = InvoiceNumber
            }, commandType: CommandType.StoredProcedure).FirstOrDefault();

            Assert.NotNull(result);
            Assert.Equal("INV0000000028PPN", result.TaxInvoiceNumber);
        }

        // ... (omitted)

        [Fact]
        public void Issue327_ReadEmptyProcedureResults()
        {
            // Actually testing for not erroring here on the mapping having no rows to map on in Read<T>();
            connection.Execute(@"
            CREATE PROCEDURE #TestEmptyResults
            AS
                SELECT Top 0 1 Id, 'Bob' Name;
                SELECT Top 0 'Billy Goat' Creature, 'Unicorn' SpiritAnimal, 'Rainbow' Location;");
            // ruleid: stored-procedure-call
            var query = connection.QueryMultiple("#TestEmptyResults", commandType: CommandType.StoredProcedure);
            var result1 = query.Read<Issue327_Person>();
            var result2 = query.Read<Issue327_Magic>();
            Assert.False(result1.Any());
            Assert.False(result2.Any());
        }

        // ... (omitted)
    }
}
