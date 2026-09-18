/**
 * OMEGA QuantBrain - Anti-Corruption Layer (ACL)
 * =================================================
 * طبقة الحماية من التلوث الصامت (Silent Corruption)
 * 
 * تمنع دخول أي قيمة فاسدة (NaN, Infinity, undefined, null, out-of-range)
 * إلى النظام، وتُنظف المصفوفات التاريخية، وتُفشل بأمان بدل التلوث الصامت.
 *
 * تُصلح الأخطاء الحرجة: #76, #77, #78, #79, #80, #81, #82, #83
 */

export interface ValidationResult {
    valid: boolean;
    value: number;
    reason?: string;
    severity: 'OK' | 'WARNING' | 'CRITICAL';
}

export interface ArrayHealthReport {
    totalElements: number;
    validElements: number;
    corruptedElements: number;
    corruptionRate: number; // 0.0 - 1.0
    isHealthy: boolean;
    lastCorruptionIndex: number;
}

export interface ConnectionHealthState {
    consecutiveFailures: number;
    lastSuccessTimestamp: number;
    lastFailureTimestamp: number;
    lastFailureReason: string;
    alertLevel: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'KILL_SWITCH';
    totalFailures: number;
    totalSuccesses: number;
}

export class AntiCorruptionLayer {

    // ==================== إعدادات الحدود ====================
    private static readonly BETA_MIN = -100;
    private static readonly BETA_MAX = 100;
    private static readonly ALPHA_MIN = -100000;
    private static readonly ALPHA_MAX = 100000;
    private static readonly SPREAD_MAX_ABS = 1e6;
    private static readonly ZSCORE_MAX_ABS = 10;
    private static readonly PRICE_MIN = 1e-8;
    private static readonly PRICE_MAX = 1e12;
    private static readonly EPSILON = 1e-10;

    // ==================== حالة صحة الاتصال ====================
    private static connectionHealth: ConnectionHealthState = {
        consecutiveFailures: 0,
        lastSuccessTimestamp: Date.now(),
        lastFailureTimestamp: 0,
        lastFailureReason: '',
        alertLevel: 'NORMAL',
        totalFailures: 0,
        totalSuccesses: 0,
    };

    // ==================== عدادات التنبيهات ====================
    private static alertCallbacks: Array<(level: string, message: string) => void> = [];

    /**
     * تسجيل دالة تنبيه (مثل إرسال تيليجرام)
     */
    public static registerAlertCallback(cb: (level: string, message: string) => void): void {
        this.alertCallbacks.push(cb);
    }

    public static emitAlert(level: 'WARNING' | 'CRITICAL' | 'KILL_SWITCH', message: string): void {
        console.error(`[ACL] 🚨 ${level}: ${message}`);
        for (const cb of this.alertCallbacks) {
            try { cb(level, message); } catch (e) { /* لا نسمح بفشل التنبيه */ }
        }
    }

    // =====================================================
    // 1️⃣ التحقق من القيم الرقمية (يُصلح #76, #80)
    // =====================================================

    /**
     * التحقق من أن قيمة رقمية صالحة (ليست NaN, Infinity, undefined, null)
     * وضمن نطاق محدد.
     */
    public static validateNumber(
        value: unknown,
        label: string,
        min: number = -Infinity,
        max: number = Infinity,
        allowNull: boolean = false
    ): ValidationResult {
        // null / undefined
        if (value === null || value === undefined) {
            if (allowNull) return { valid: true, value: 0, severity: 'OK' };
            return {
                valid: false,
                value: 0,
                reason: `${label} is ${value}`,
                severity: 'CRITICAL'
            };
        }

        // ليس رقماً
        if (typeof value !== 'number') {
            return {
                valid: false,
                value: 0,
                reason: `${label} is not a number: ${typeof value}`,
                severity: 'CRITICAL'
            };
        }

        // NaN
        if (isNaN(value)) {
            return {
                valid: false,
                value: 0,
                reason: `${label} is NaN`,
                severity: 'CRITICAL'
            };
        }

        // Infinity
        if (!isFinite(value)) {
            return {
                valid: false,
                value: 0,
                reason: `${label} is ${value > 0 ? '+' : '-'}Infinity`,
                severity: 'CRITICAL'
            };
        }

        // خارج النطاق
        if (value < min || value > max) {
            return {
                valid: false,
                value: 0,
                reason: `${label} = ${value} out of range [${min}, ${max}]`,
                severity: 'WARNING'
            };
        }

        return { valid: true, value, severity: 'OK' };
    }

    /**
     * التحقق من سعر عملة (يُصلح #80)
     */
    public static validatePrice(price: unknown, symbol: string): ValidationResult {
        const result = this.validateNumber(price, `${symbol}.price`, this.PRICE_MIN, this.PRICE_MAX);
        if (!result.valid) {
            this.emitAlert('CRITICAL', `Invalid price for ${symbol}: ${result.reason}`);
        }
        return result;
    }

    /**
     * التحقق من قيمة Beta (يُصلح #78)
     */
    public static validateBeta(beta: unknown, symbol: string): ValidationResult {
        const result = this.validateNumber(beta, `${symbol}.beta`, this.BETA_MIN, this.BETA_MAX);
        if (!result.valid) {
            this.emitAlert('CRITICAL', `Beta corruption for ${symbol}: ${result.reason}`);
        }
        return result;
    }

    /**
     * التحقق من قيمة Alpha (يُصلح #78)
     */
    public static validateAlpha(alpha: unknown, symbol: string): ValidationResult {
        const result = this.validateNumber(alpha, `${symbol}.alpha`, this.ALPHA_MIN, this.ALPHA_MAX);
        if (!result.valid) {
            this.emitAlert('CRITICAL', `Alpha corruption for ${symbol}: ${result.reason}`);
        }
        return result;
    }

    /**
     * التحقق من قيمة Spread (يُصلح #79)
     */
    public static validateSpread(spread: unknown, symbol: string): ValidationResult {
        const result = this.validateNumber(spread, `${symbol}.spread`, -this.SPREAD_MAX_ABS, this.SPREAD_MAX_ABS);
        if (!result.valid) {
            this.emitAlert('WARNING', `Spread corruption for ${symbol}: ${result.reason}`);
        }
        return result;
    }

    /**
     * التحقق من قيمة Z-Score
     */
    public static validateZScore(zScore: unknown, symbol: string): ValidationResult {
        const result = this.validateNumber(zScore, `${symbol}.zScore`, -this.ZSCORE_MAX_ABS, this.ZSCORE_MAX_ABS);
        if (!result.valid) {
            this.emitAlert('WARNING', `Z-Score corruption for ${symbol}: ${result.reason}`);
        }
        return result;
    }

    /**
     * التحقق من Half-Life (يُصلح #76)
     */
    public static validateHalfLife(halfLife: unknown, symbol: string): ValidationResult {
        const result = this.validateNumber(halfLife, `${symbol}.halfLife`, 0, 86400);
        if (!result.valid) {
            return result;
        }
        if (result.value === 0) {
            return { valid: true, value: 0, reason: 'No mean-reversion detected', severity: 'WARNING' };
        }
        return result;
    }

    // =====================================================
    // 2️⃣ التحقق من مصفوفة التباين P (يُصلح #77)
    // =====================================================

    public static validateCovarianceMatrix(
        P: number[][],
        label: string
    ): ValidationResult {
        if (!Array.isArray(P) || P.length !== 2 || !Array.isArray(P[0]) || P[0].length !== 2) {
            return { valid: false, value: 0, reason: `${label}: Invalid matrix dimensions`, severity: 'CRITICAL' };
        }

        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                if (!isFinite(P[i][j]) || isNaN(P[i][j])) {
                    return { valid: false, value: 0, reason: `${label}[${i}][${j}] = ${P[i][j]}`, severity: 'CRITICAL' };
                }
            }
        }

        if (P[0][0] < -this.EPSILON || P[1][1] < -this.EPSILON) {
            return { valid: false, value: 0, reason: `${label}: Negative variance on diagonal`, severity: 'CRITICAL' };
        }

        if (Math.abs(P[0][1] - P[1][0]) > 1e-6) {
            return { valid: false, value: 0, reason: `${label}: Matrix not symmetric`, severity: 'WARNING' };
        }

        const det = P[0][0] * P[1][1] - P[0][1] * P[1][0];
        if (det < -this.EPSILON) {
            return { valid: false, value: 0, reason: `${label}: Negative determinant = ${det}`, severity: 'CRITICAL' };
        }

        return { valid: true, value: det, severity: 'OK' };
    }

    public static validateInnovationCovariance(S: number, symbol: string): ValidationResult {
        if (!isFinite(S) || isNaN(S)) {
            this.emitAlert('CRITICAL', `Innovation covariance S = ${S} for ${symbol}. Kalman update aborted.`);
            return { valid: false, value: 0, reason: `S = ${S}`, severity: 'CRITICAL' };
        }
        if (Math.abs(S) < this.EPSILON) {
            this.emitAlert('WARNING', `Innovation covariance S ≈ ${S} for ${symbol}. Near-zero division risk.`);
            return { valid: false, value: 0, reason: `S ≈ 0 (${S})`, severity: 'WARNING' };
        }
        if (S < 0) {
            this.emitAlert('CRITICAL', `Innovation covariance S = ${S} < 0 for ${symbol}. Invalid variance.`);
            return { valid: false, value: 0, reason: `S < 0`, severity: 'CRITICAL' };
        }
        return { valid: true, value: S, severity: 'OK' };
    }

    public static validateKalmanGain(K: number[], symbol: string): ValidationResult {
        for (let i = 0; i < K.length; i++) {
            if (!isFinite(K[i]) || isNaN(K[i])) {
                this.emitAlert('CRITICAL', `Kalman gain K[${i}] = ${K[i]} for ${symbol}. Aborting update.`);
                return { valid: false, value: 0, reason: `K[${i}] = ${K[i]}`, severity: 'CRITICAL' };
            }
            if (Math.abs(K[i]) > 1000) {
                this.emitAlert('WARNING', `Kalman gain K[${i}] = ${K[i]} for ${symbol}. Unusually large.`);
                return { valid: false, value: 0, reason: `K[${i}] too large`, severity: 'WARNING' };
            }
        }
        return { valid: true, value: 0, severity: 'OK' };
    }

    // =====================================================
    // 3️⃣ تنظيف المصفوفات التاريخية (يُصلح #79)
    // =====================================================

    public static sanitizeArray(arr: number[], label: string): number[] {
        if (!Array.isArray(arr)) {
            this.emitAlert('CRITICAL', `${label} is not an array`);
            return [];
        }

        const clean = arr.filter(v => isFinite(v) && !isNaN(v));
        const removed = arr.length - clean.length;

        if (removed > 0) {
            const rate = removed / arr.length;
            if (rate > 0.1) {
                this.emitAlert('CRITICAL', `${label}: ${removed}/${arr.length} elements corrupted (${(rate * 100).toFixed(1)}%)`);
            } else {
                console.warn(`[ACL] ${label}: Removed ${removed} corrupted elements`);
            }
        }

        return clean;
    }

    public static checkArrayHealth(arr: number[], label: string): ArrayHealthReport {
        if (!Array.isArray(arr) || arr.length === 0) {
            return {
                totalElements: 0,
                validElements: 0,
                corruptedElements: 0,
                corruptionRate: 0,
                isHealthy: true,
                lastCorruptionIndex: -1,
            };
        }

        let corrupted = 0;
        let lastCorruptionIndex = -1;

        for (let i = 0; i < arr.length; i++) {
            if (!isFinite(arr[i]) || isNaN(arr[i])) {
                corrupted++;
                lastCorruptionIndex = i;
            }
        }

        const rate = corrupted / arr.length;
        const isHealthy = rate < 0.05;

        if (!isHealthy) {
            this.emitAlert('CRITICAL', `${label}: Corruption rate ${(rate * 100).toFixed(1)}% (${corrupted}/${arr.length})`);
        }

        return {
            totalElements: arr.length,
            validElements: arr.length - corrupted,
            corruptedElements: corrupted,
            corruptionRate: rate,
            isHealthy,
            lastCorruptionIndex,
        };
    }

    // =====================================================
    // 4️⃣ إدارة صحة الاتصال (يُصلح #81, #82)
    // =====================================================

    public static recordConnectionSuccess(exchangeName: string): void {
        const prev = this.connectionHealth.consecutiveFailures;
        this.connectionHealth.consecutiveFailures = 0;
        this.connectionHealth.lastSuccessTimestamp = Date.now();
        this.connectionHealth.totalSuccesses++;
        this.connectionHealth.alertLevel = 'NORMAL';

        if (prev > 0) {
            console.log(`[ACL] ✅ Connection to ${exchangeName} restored after ${prev} failures`);
        }
    }

    public static recordConnectionFailure(exchangeName: string, reason: string): void {
        const health = this.connectionHealth;
        health.consecutiveFailures++;
        health.lastFailureTimestamp = Date.now();
        health.lastFailureReason = reason;
        health.totalFailures++;

        const n = health.consecutiveFailures;

        if (n === 3) {
            health.alertLevel = 'WARNING';
            this.emitAlert('WARNING', `Connection to ${exchangeName} failed ${n} times. Reason: ${reason}`);
        } else if (n === 5) {
            health.alertLevel = 'CRITICAL';
            this.emitAlert('CRITICAL', `⚠️ Connection to ${exchangeName} failed ${n} times consecutively! Last reason: ${reason}`);
        } else if (n === 10) {
            health.alertLevel = 'CRITICAL';
            this.emitAlert('CRITICAL', `🚨 CRITICAL: ${exchangeName} unreachable for ${n} cycles. Trading signals UNRELIABLE.`);
        } else if (n === 20) {
            health.alertLevel = 'KILL_SWITCH';
            this.emitAlert('KILL_SWITCH', `💀 KILL SWITCH RECOMMENDED: ${exchangeName} unreachable for ${n} cycles (${Math.round(n * 8 / 60)} minutes). AUTO-TRADING SHOULD BE HALTED.`);
        } else if (n > 20 && n % 10 === 0) {
            this.emitAlert('KILL_SWITCH', `💀 Still unreachable: ${n} cycles. Total downtime: ${Math.round(n * 8 / 60)} min.`);
        }
    }

    public static getConnectionHealth(): ConnectionHealthState {
        return { ...this.connectionHealth };
    }

    public static shouldHaltTrading(): boolean {
        return this.connectionHealth.consecutiveFailures >= 10;
    }

    public static shouldTriggerKillSwitch(): boolean {
        return this.connectionHealth.consecutiveFailures >= 20;
    }

    public static resetConnectionHealth(): void {
        this.connectionHealth = {
            consecutiveFailures: 0,
            lastSuccessTimestamp: Date.now(),
            lastFailureTimestamp: 0,
            lastFailureReason: '',
            alertLevel: 'NORMAL',
            totalFailures: 0,
            totalSuccesses: 0,
        };
    }

    // =====================================================
    // 5️⃣ إعادة تصفير كالمان عند التلوث (يُصلح #77, #78, #79)
    // =====================================================

    public static getResetKalmanState(initialBeta: number, initialAlpha: number): {
        beta: number;
        alpha: number;
        P: number[][];
    } {
        const safeBeta = isFinite(initialBeta) ? Math.max(this.BETA_MIN, Math.min(this.BETA_MAX, initialBeta)) : 1.0;
        const safeAlpha = isFinite(initialAlpha) ? Math.max(this.ALPHA_MIN, Math.min(this.ALPHA_MAX, initialAlpha)) : 0.0;

        console.warn(`[ACL] 🔄 Kalman filter reset. Beta → ${safeBeta.toFixed(4)}, Alpha → ${safeAlpha.toFixed(4)}`);

        return {
            beta: safeBeta,
            alpha: safeAlpha,
            P: [[0.001, 0], [0, 0.001]],
        };
    }

    // =====================================================
    // 6️⃣ فحص دوري شامل (كل 100 دورة)
    // =====================================================

    public static runFullHealthCheck(
        kalmanFilters: Map<string, { getHistory(): { beta: number[]; spread: number[] } }>
    ): { healthy: number; corrupted: number; reset: number; details: string[] } {
        const details: string[] = [];
        let healthy = 0;
        let corrupted = 0;
        let reset = 0;

        kalmanFilters.forEach((kf, symbol) => {
            const history = kf.getHistory();

            const spreadHealth = this.checkArrayHealth(history.spread, `${symbol}.spreadHistory`);
            const betaHealth = this.checkArrayHealth(history.beta, `${symbol}.betaHistory`);

            if (spreadHealth.isHealthy && betaHealth.isHealthy) {
                healthy++;
            } else {
                corrupted++;
                details.push(`${symbol}: spread=${(spreadHealth.corruptionRate * 100).toFixed(1)}%, beta=${(betaHealth.corruptionRate * 100).toFixed(1)}%`);

                if (spreadHealth.corruptionRate > 0.2 || betaHealth.corruptionRate > 0.2) {
                    reset++;
                    details.push(`${symbol}: RESET triggered (corruption > 20%)`);
                }
            }
        });

        if (corrupted > 0) {
            console.warn(`[ACL] Health check: ${healthy} healthy, ${corrupted} corrupted, ${reset} reset`);
        }

        return { healthy, corrupted, reset, details };
    }
}
