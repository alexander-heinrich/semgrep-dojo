// Source: https://github.com/dotnet/BenchmarkDotNet/blob/5995bf68f9ae7864ec12916c7b426b02759d1ad5/samples/BenchmarkDotNet.Samples/IntroSetupCleanupIteration.cs  (lines 1-33)
// Copyright (c) 2013–2025 .NET Foundation and contributors. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: no — only `// ruleid:` / `// ok:` annotation comments were added.
using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Engines;

namespace BenchmarkDotNet.Samples
{
    [SimpleJob(RunStrategy.Monitoring, launchCount: 1,
        warmupCount: 2, iterationCount: 3)]
    public class IntroSetupCleanupIteration
    {
        private int setupCounter;
        private int cleanupCounter;

        [IterationSetup]
        public void IterationSetup()
            // ok: writeline-literal
            => Console.WriteLine($"// IterationSetup ({++setupCounter})");

        [IterationCleanup]
        public void IterationCleanup()
            // ok: writeline-literal
            => Console.WriteLine($"// IterationCleanup ({++cleanupCounter})");

        [GlobalSetup]
        public void GlobalSetup()
            // ruleid: writeline-literal
            => Console.WriteLine("// " + "GlobalSetup");

        [GlobalCleanup]
        public void GlobalCleanup()
            // ruleid: writeline-literal
            => Console.WriteLine("// " + "GlobalCleanup");

        [Benchmark]
        public void Benchmark()
            // ruleid: writeline-literal
            => Console.WriteLine("// " + "Benchmark");
    }
}
