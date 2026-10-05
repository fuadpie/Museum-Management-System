export function formatCurrency(amount) {
    return `৳${Number(amount || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}
