/**
 * FastMath & Typed Array acceleration for quantum operations and linear algebra
 */
export class FastMath {
    /**
     * Matrix multiplication using Float64Array
     */
    static matrixMultiply(a: Float64Array, b: Float64Array, rows: number, cols: number): Float64Array {
        const result = new Float64Array(rows * cols);
        
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                let sum = 0;
                for (let k = 0; k < cols; k++) {
                    sum += a[i * cols + k] * b[k * cols + j];
                }
                result[i * cols + j] = sum;
            }
        }
        
        return result;
    }
    
    /**
     * Fast single qubit gate application
     */
    static applyGateFast(state: Float64Array, gate: Float64Array): Float64Array {
        const n = Math.floor(state.length / 2);
        const newState = new Float64Array(state.length);
        
        for (let i = 0; i < n; i++) {
            const re0 = state[i * 2];
            const im0 = state[i * 2 + 1];
            const re1 = state[(i + n) * 2];
            const im1 = state[(i + n) * 2 + 1];
            
            // 2x2 gate elements: [g00re, g00im, g01re, g01im, g10re, g10im, g11re, g11im]
            const g00re = gate[0], g00im = gate[1];
            const g01re = gate[2], g01im = gate[3];
            const g10re = gate[4], g10im = gate[5];
            const g11re = gate[6], g11im = gate[7];
            
            newState[i * 2] = g00re * re0 - g00im * im0 + g01re * re1 - g01im * im1;
            newState[i * 2 + 1] = g00re * im0 + g00im * re0 + g01re * im1 + g01im * re1;
            newState[(i + n) * 2] = g10re * re0 - g10im * im0 + g11re * re1 - g11im * im1;
            newState[(i + n) * 2 + 1] = g10re * im0 + g10im * re0 + g11re * im1 + g11im * re1;
        }
        
        return newState;
    }
    
    /**
     * Fast normalization of state vector
     */
    static normalizeFast(state: Float64Array): void {
        let norm = 0;
        for (let i = 0; i < state.length; i++) {
            norm += state[i] * state[i];
        }
        norm = Math.sqrt(norm);
        
        if (norm > 0) {
            const inv = 1 / norm;
            for (let i = 0; i < state.length; i++) {
                state[i] *= inv;
            }
        }
    }
    
    /**
     * Compute expectation value fast
     */
    static expectationValueFast(state: Float64Array): number {
        let exp = 0;
        const n = Math.floor(state.length / 4);
        for (let i = 0; i < n; i++) {
            const re = state[i * 2];
            const im = state[i * 2 + 1];
            exp += re * re + im * im;
        }
        for (let i = n; i < n * 2; i++) {
            const re = state[i * 2];
            const im = state[i * 2 + 1];
            exp -= re * re + im * im;
        }
        return exp;
    }
}

/**
 * ObjectPool to eliminate Garbage Collection overhead in sub-millisecond pipelines
 */
export class ObjectPool<T> {
    private pool: T[] = [];
    private factory: () => T;
    private reset: (obj: T) => void;
    
    constructor(factory: () => T, reset: (obj: T) => void, initialSize: number = 10) {
        this.factory = factory;
        this.reset = reset;
        
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(factory());
        }
    }
    
    acquire(): T {
        return this.pool.length > 0 ? this.pool.pop()! : this.factory();
    }
    
    release(obj: T): void {
        this.reset(obj);
        this.pool.push(obj);
    }
}

/**
 * High-performance Memoization Cache with Time-To-Live
 */
export class MemoCache<K, V> {
    private cache = new Map<K, { value: V; timestamp: number }>();
    private ttlMs: number;
    private maxSize: number;
    
    constructor(ttlMs: number = 60000, maxSize: number = 1000) {
        this.ttlMs = ttlMs;
        this.maxSize = maxSize;
    }
    
    get(key: K): V | undefined {
        const entry = this.cache.get(key);
        if (!entry) return undefined;
        
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            return undefined;
        }
        
        return entry.value;
    }
    
    set(key: K, value: V): void {
        if (this.cache.size >= this.maxSize) {
            const oldest = this.cache.keys().next().value;
            if (oldest !== undefined) this.cache.delete(oldest);
        }
        
        this.cache.set(key, { value, timestamp: Date.now() });
    }
    
    clear(): void {
        this.cache.clear();
    }
}
