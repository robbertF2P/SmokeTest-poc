using System.Diagnostics;
using System.Text;
using Xunit;

namespace Floor2PlanSmokeTests;

public sealed class LoginSmokeTests
{
    private const string DefaultTargetUrl = "https://2025-14-patch.floor2plan.com/Account/Login";

    [Fact]
    public async Task Login_page_smoke_test_passes()
    {
        var projectDirectory = GetProjectDirectory();
        var targetUrls = Environment.GetEnvironmentVariable("TARGET_URLS");
        var targetUrl = Environment.GetEnvironmentVariable("TARGET_URL");
        var configuredTargets = !string.IsNullOrWhiteSpace(targetUrls)
            ? targetUrls
            : !string.IsNullOrWhiteSpace(targetUrl)
                ? targetUrl
                : DefaultTargetUrl;

        var result = await RunProcessAsync(
            "npx",
            "cypress run --spec cypress/e2e/login_smoke.cy.js",
            projectDirectory,
            configuredTargets);

        Assert.True(
            result.ExitCode == 0,
            $"Cypress smoke test failed with exit code {result.ExitCode}.{Environment.NewLine}{result.Output}");
    }

    private static string GetProjectDirectory()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);

        while (current is not null)
        {
            if (File.Exists(Path.Combine(current.FullName, "package.json")) &&
                File.Exists(Path.Combine(current.FullName, "cypress.config.js")))
            {
                return current.FullName;
            }

            current = current.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate the Cypress project directory.");
    }

    private static async Task<(int ExitCode, string Output)> RunProcessAsync(
        string fileName,
        string arguments,
        string workingDirectory,
        string targetUrls)
    {
        var output = new StringBuilder();
        var startInfo = new ProcessStartInfo
        {
            FileName = fileName,
            Arguments = arguments,
            WorkingDirectory = workingDirectory,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };

        startInfo.Environment["TARGET_URLS"] = targetUrls;

        var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        process.OutputDataReceived += (_, args) => AppendLine(output, args.Data);
        process.ErrorDataReceived += (_, args) => AppendLine(output, args.Data);

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        await process.WaitForExitAsync();

        return (process.ExitCode, output.ToString());
    }

    private static void AppendLine(StringBuilder output, string? data)
    {
        if (data is not null)
        {
            output.AppendLine(data);
        }
    }
}
