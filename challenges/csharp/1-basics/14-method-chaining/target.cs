// Source: https://github.com/serilog/serilog/blob/49b5339ce85385dc52d4d8e8f2b8308becf23506/test/Serilog.Tests/Core/LoggerTests.cs  (lines 1-9, 176-187, 221-261, 306-309)
// Copyright (c) Serilog Contributors. Licensed under Apache-2.0. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — file-scoped namespace turned into a block; unrelated tests replaced by `// ... (omitted)`; `#if FEATURE_DEFAULT_INTERFACE` guard around the first test dropped; annotation comments added.
using System.Diagnostics;

#pragma warning disable Serilog004 // Constant MessageTemplate verifier
#pragma warning disable Serilog003 // Property binding verifier

namespace Serilog.Tests.Core
{
    public class LoggerTests
    {
        // ... (omitted)

        [Fact]
        public void DelegatingLoggerShouldDelegateCallsToInnerLogger()
        {
            var collectingSink = new CollectingSink();
            var levelSwitch = new LoggingLevelSwitch();

            var innerLogger =
                // ruleid: logger-configuration-chain
                new LoggerConfiguration()
                    .MinimumLevel.ControlledBy(levelSwitch)
                    .WriteTo.Sink(collectingSink)
                    .CreateLogger();

            // ... (omitted)
        }

        [Fact]
        public void ASingleSinkIsDisposedWhenLoggerIsDisposed()
        {
            var sink = new DisposeTrackingSink();
            // ruleid: logger-configuration-chain
            var log = new LoggerConfiguration()
                .WriteTo.Sink(sink)
                .CreateLogger();

            log.Dispose();

            Assert.True(sink.IsDisposed);
        }

        [Fact]
        public void AggregatedSinksAreDisposedWhenLoggerIsDisposed()
        {
            var sinkA = new DisposeTrackingSink();
            var sinkB = new DisposeTrackingSink();
            // ruleid: logger-configuration-chain
            var log = new LoggerConfiguration()
                .WriteTo.Sink(sinkA)
                .WriteTo.Sink(sinkB)
                .CreateLogger();

            log.Dispose();

            Assert.True(sinkA.IsDisposed);
            Assert.True(sinkB.IsDisposed);
        }

        [Fact]
        public void WrappedSinksAreDisposedWhenLoggerIsDisposed()
        {
            var sink = new DisposeTrackingSink();
            // ruleid: logger-configuration-chain
            var log = new LoggerConfiguration()
                .WriteTo.DummyWrapper(wrapped => wrapped.Sink(sink))
                .CreateLogger();

            log.Dispose();

            Assert.True(sink.IsDisposed);
        }

        [Fact]
        public void NullMessageTemplateParametersDoNotBreakBinding()
        {
            // ruleid: logger-configuration-chain
            var log = new LoggerConfiguration().WriteTo.Sink(new CollectingSink()).CreateLogger();

            // ... (omitted)
        }
    }
}
