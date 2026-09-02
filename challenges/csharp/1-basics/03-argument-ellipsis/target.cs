// Source: https://github.com/DapperLib/Dapper/blob/6d48ef664acc7298c649e2d449d903b3360d5a90/tests/Dapper.Tests/ProcedureTests.cs  (lines 1-104, 345-346)
// Copyright (c) Stack Exchange, Inc. Licensed under Apache-2.0. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: no
using System;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace Dapper.Tests
{
    [Collection("ProcedureTests")]
    public sealed class SystemSqlClientProcedureTests : ProcedureTests<SystemSqlClientProvider> { }
    // ... (omitted)
    public abstract class ProcedureTests<TProvider> : TestBase<TProvider> where TProvider : DatabaseProvider
    {
        [Fact]
        public void TestProcWithOutParameter()
        {
            // ok: execute-with-parameters
            connection.Execute(
            @"CREATE PROCEDURE #TestProcWithOutParameter
                @ID int output,
                @Foo varchar(100),
                @Bar int
            AS
                SET @ID = @Bar + LEN(@Foo)");
            var obj = new
            {
                ID = 0,
                Foo = "abc",
                Bar = 4
            };
            var args = new DynamicParameters(obj);
            args.Add("ID", 0, direction: ParameterDirection.Output);
            // ruleid: execute-with-parameters
            connection.Execute("#TestProcWithOutParameter", args, commandType: CommandType.StoredProcedure);
            Assert.Equal(7, args.Get<int>("ID"));
        }

        [Fact]
        public void TestProcWithOutAndReturnParameter()
        {
            // ok: execute-with-parameters
            connection.Execute(
            @"CREATE PROCEDURE #TestProcWithOutAndReturnParameter
                @ID int output,
                @Foo varchar(100),
                @Bar int
            AS
                SET @ID = @Bar + LEN(@Foo)
                RETURN 42");
            var obj = new
            {
                ID = 0,
                Foo = "abc",
                Bar = 4
            };
            var args = new DynamicParameters(obj);
            args.Add("ID", 0, direction: ParameterDirection.Output);
            args.Add("result", 0, direction: ParameterDirection.ReturnValue);
            // ruleid: execute-with-parameters
            connection.Execute("#TestProcWithOutAndReturnParameter", args, commandType: CommandType.StoredProcedure);
            Assert.Equal(7, args.Get<int>("ID"));
            Assert.Equal(42, args.Get<int>("result"));
        }

        // ... (omitted)
        [Theory]
        [InlineData(CommandType.StoredProcedure)]
        [InlineData(null)] // auto
        public void InferProcedure(CommandType? commandType)
        {
            // ok: execute-with-parameters
            connection.Execute("CREATE PROCEDURE #InferProcedure @id int AS BEGIN SELECT -@id END");
            var result = connection.QuerySingle<int>("#InferProcedure", new { id = 42 }, commandType: commandType);
            Assert.Equal(-42, result);
        }

        // ... (omitted)
    }
}
