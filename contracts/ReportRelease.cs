// Decryption policy for sealed reports. Written and compile-checked here; the Tide team reviews and
// deploys it (do not upload it ourselves). Release needs M steward approvals; only an investigator
// may execute the decrypt. M must match the admin-set steward quorum (quorum_m).
using Ork.Forseti.Sdk;
using Cryptide.Tools;
using Ork.Shared.Models.Contracts;
using System;
using System.Collections.Generic;
using System.Text;

public class Contract : IAccessPolicy
{
    [PolicyParam(Required = true, Description = "Client the roles are checked against")]
    public string Resource { get; set; }

    [PolicyParam(Default = 2, Min = 2, Description = "Steward approvals needed to release a case")]
    public int MinStewards { get; set; }

    [PolicyParam(Default = "steward")]
    public string StewardRole { get; set; }

    [PolicyParam(Default = "investigator")]
    public string InvestigatorRole { get; set; }

    public PolicyDecision ValidateData(DataContext ctx)
    {
        return PolicyDecision.Allow();
    }

    public PolicyDecision ValidateApprovers(ApproversContext ctx)
    {
        var approvers = DokenDto.WrapAll(ctx.Dokens);
        return Decision.RequireMinWithRole(approvers, MinStewards, Resource, StewardRole);
    }

    public PolicyDecision ValidateExecutor(ExecutorContext ctx)
    {
        var executor = new DokenDto(ctx.Doken);
        return Decision
            .RequireNotExpired(executor)
            .RequireRole(executor, Resource, InvestigatorRole);
    }
}
