package com.tradingbot.bearish;

import com.tradingbot.bearishassist.BearishBiasState;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/** Phase 209 — grades manual PUT workflows (no auto execution). */
@Component
public class PutAssistGradeEvaluator {

    public record GradeResult(PutAssistGrade grade, List<String> reasons) {}

    public GradeResult evaluate(BearishStructureSignals signals, BearishEnvironment environment) {
        List<String> reasons = new ArrayList<>();

        if (environment == BearishEnvironment.HOSTILE) {
            reasons.add("Broad market recovery / hostile bearish environment");
            return new GradeResult(PutAssistGrade.AVOID, reasons);
        }
        if (signals.squeezeRiskScore() >= 75) {
            reasons.add("High squeeze risk");
            return new GradeResult(PutAssistGrade.AVOID, reasons);
        }
        if (signals.bearishState() == BearishBiasState.EXHAUSTION_BOUNCE) {
            reasons.add("Exhaustion bounce risk");
            return new GradeResult(PutAssistGrade.AVOID, reasons);
        }

        boolean aPlus = signals.failedReclaim()
                && signals.rejectionPersistence() >= 70
                && signals.downsideRvol() >= 2.0
                && signals.squeezeRiskScore() <= 40
                && signals.breakdownAcceleration() >= 65;

        if (aPlus) {
            reasons.add("Ideal failed reclaim breakdown");
            return new GradeResult(PutAssistGrade.A_PLUS, reasons);
        }
        if (signals.failedReclaim() && signals.rejectionPersistence() >= 55) {
            return new GradeResult(PutAssistGrade.A, reasons);
        }
        if (signals.rejectionPersistence() >= 45 && signals.breakdownAcceleration() >= 48) {
            return new GradeResult(PutAssistGrade.B, reasons);
        }
        reasons.add("Weak bearish structure for PUT assist");
        return new GradeResult(PutAssistGrade.AVOID, reasons);
    }
}
