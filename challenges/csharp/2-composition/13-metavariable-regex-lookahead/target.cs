// Source: https://github.com/dotnet/aspnetcore/blob/c85baf8db0c72ae8e68643029d514b2e737c9fae/src/Middleware/CORS/test/UnitTests/CorsPolicyBuilderTests.cs  (lines 4-7, 110-146, 189-201)
// Copyright (c) .NET Foundation and Contributors. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — four of the test methods kept, the rest replaced by `// ... (omitted)`; annotation comments added.
namespace Microsoft.AspNetCore.Cors.Infrastructure;

public class CorsPolicyBuilderTests
{

    [Fact]
    public void WithOrigins_AddsOrigins()
    {
        // Arrange
        var builder = new CorsPolicyBuilder();

        // Act
        // ruleid: insecure-cors-origin
        builder.WithOrigins("http://example.com", "http://example2.com");

        // Assert
        var corsPolicy = builder.Build();
        Assert.False(corsPolicy.AllowAnyOrigin);
        // ok: insecure-cors-origin
        Assert.Equal(new List<string>() { "http://example.com", "http://example2.com" }, corsPolicy.Origins);
    }

    [Fact]
    public void WithOrigins_NormalizesOrigins()
    {
        // Arrange
        // ruleid: insecure-cors-origin
        var builder = new CorsPolicyBuilder("http://www.EXAMPLE.com", "HTTPS://example2.com");

        // Assert
        var corsPolicy = builder.Build();
        Assert.Equal(new List<string>() { "http://www.example.com", "https://example2.com" }, corsPolicy.Origins);
    }

    [Fact]
    public void WithOrigins_ThrowsIfArgumentNull()
    {
        // Arrange
        var builder = new CorsPolicyBuilder();
        string[] args = null;

        // Act / Assert
        // ok: insecure-cors-origin
        Assert.Throws<ArgumentNullException>(() => builder.WithOrigins(args));
    }
    // ... (omitted)
    [Fact]
    public void SetIsOriginAllowedToAllowWildcardSubdomains_AllowsWildcardSubdomains()
    {
        // Arrange
        // ruleid: insecure-cors-origin
        var builder = new CorsPolicyBuilder("http://*.example.com");

        // Act
        builder.SetIsOriginAllowedToAllowWildcardSubdomains();

        // Assert
        var corsPolicy = builder.Build();
        // ok: insecure-cors-origin
        Assert.True(corsPolicy.IsOriginAllowed("http://test.example.com"));
    }

    // ... (omitted)
}
