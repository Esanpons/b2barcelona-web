// --- Helpers para formateo ---
function fmtNum(n, decimals = 2) {
    return n.toLocaleString(i18n.lang === 'ca' ? 'ca-ES' : 'es-ES', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function fmtCurrency(n) {
    return `${fmtNum(n)} €`;
}

function fmtDate(d) {
    return new Date(d).toLocaleDateString(i18n.lang === 'ca' ? 'ca-ES' : 'es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

async function printInvoice(inv) {
    const originalLang = i18n.lang;
    const originalDict = i18n.dict;
    const buyer = customers.find(c => c.no === inv.customerNo) || {};
    const seller = company || {};

    try {
        const invoiceLang = buyer.customerPrintLanguaje || originalLang;
        if (invoiceLang !== originalLang) {
            try {
                const respLang = await fetch(`assets/lang-${invoiceLang}.json`);
                i18n.dict = await respLang.json();
                i18n.lang = invoiceLang;
            } catch (e) {
                console.error('Error al cargar idioma de factura:', e);
            }
        }

        const resp = await fetch('html/invoice-print.html');
        if (!resp.ok) {
            throw new Error(i18n.t('No se pudo cargar html/invoice-print.html'));
        }
        const template = await resp.text();

        const sellerHtml = `
            <p><strong> ${seller.name}</strong></p>
            <p><strong>NIF:</strong> ${seller.cif}</p>
            <p><strong>EMAIL:</strong> ${seller.email}</p>
            <p>${seller.address}</p>
        `;
        const buyerHtml = `
            <p><strong> ${buyer.name}</strong></p>
            <p><strong>NIF:</strong> ${buyer.cif}</p>
            <p><strong>EMAIL:</strong> ${buyer.email}</p>
            <p>${buyer.address}</p>
        `;
        const linesHtml = inv.lines.map(l => `
            <tr>
                <td>${l.description}</td>
                <td style="text-align: right;">${fmtNum(l.qty)}</td>
                <td style="text-align: right;">${fmtCurrency(inv.priceHour)}</td>
                <td style="text-align: right;">${fmtCurrency(l.qty * inv.priceHour)}</td>
            </tr>
        `).join('');

        const vatRate = parseFloat(inv.vat);
        const hasVat = Number.isFinite(vatRate) && vatRate !== 0;
        const irpfRate = parseFloat(inv.irpf);
        const hasIrpf = Number.isFinite(irpfRate) && irpfRate !== 0;
        const formatPercent = (rate) => fmtNum(rate, Number.isInteger(rate) ? 0 : 2);

        const base = inv.lines.reduce((sum, l) => sum + (l.qty * inv.priceHour), 0);
        const ivaAmount = hasVat ? base * (vatRate / 100) : 0;
        const irpfAmount = hasIrpf ? base * (irpfRate / 100) : 0;
        const totalAmount = base + ivaAmount - irpfAmount;

        const totals = [
            `<div><span class="total-label">Base</span> <span>${fmtCurrency(base)}</span></div>`
        ];

        if (hasVat) {
            totals.push(`<div><span class="total-label">+ IVA (${formatPercent(vatRate)}%)</span> <span>${fmtCurrency(ivaAmount)}</span></div>`);
        }

        if (hasIrpf) {
            totals.push(`<div><span class="total-label">- IRPF (${formatPercent(irpfRate)}%)</span> <span>${fmtCurrency(irpfAmount)}</span></div>`);
        }

        totals.push(`<div class="final-total"><span class="total-label">TOTAL</span> <span>${fmtCurrency(totalAmount)}</span></div>`);

        const totalsHtml = totals.join('');

        const typeLabel = totalAmount < 0 ? i18n.t('Factura rectificativa') : i18n.t('Factura');

        const finalHtml = template
            .replace(/{{TYPE}}/g, typeLabel)
            .replace(/{{NO}}/g, inv.no)
            .replace('{{DATE}}', fmtDate(inv.date))
            .replace('{{SELLER}}', sellerHtml)
            .replace('{{BUYER}}', buyerHtml)
            .replace('{{LINES}}', linesHtml)
            .replace('{{TOTALS}}', totalsHtml)
            .replace('{{IBAN}}', seller.iban)
            .replace('{{PAGE_NUM}}', 1)
            .replace('{{PAGE_TOTAL}}', 1);

        let iframe = document.getElementById('printing-frame');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'printing-frame';
            iframe.style.position = 'absolute';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);
        }

        const iframeDoc = iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(finalHtml);
        iframeDoc.close();
        iframeDoc.documentElement.lang = i18n.lang;
        if (window.i18n) i18n.apply(iframeDoc);

        if (invoiceLang !== originalLang) {
            i18n.lang = originalLang;
            i18n.dict = originalDict;
        }

        iframe.onload = function () {
            setTimeout(function () {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }, 200);
        };

    } catch (error) {
        console.error('Error al generar la factura:', error);
        i18n.lang = originalLang;
        i18n.dict = originalDict;
    }
}
