
import { ComplianceKernelService } from '../src/services/compliance-kernel.service';
import { UniversalRequirement, GrammarType } from '../src/types/spec-grammar.types';
import { BimProperty } from '../src/services/bim-query.service';

function testKernel() {
    console.log('⚖️  Testing Compliance Kernel Logic...');

    const kernel = new ComplianceKernelService();

    // 1. Mock Requirement (From Spec)
    // "Concrete Strength shall be >= 30"
    const mockReq: UniversalRequirement = {
        id: 'req-1',
        sourceLine: 1,
        originalText: 'Concrete Strength >= 30',
        grammarType: GrammarType.KEY_VALUE_PAIR,
        parameter: 'Concrete Strength',
        operator: '>=',
        value: '30',
        normalized: { value: 30, unit: 'MPa' }, // Simplified unit
        confidence: 0.9
    };

    // 2. Mock Elements (From BIM)
    const elements: BimProperty[] = [
        {
            elementId: 101,
            name: 'Column C-1',
            category: 'Structural Columns',
            properties: {
                'Identity Data/Type Name': 'C-1',
                // CASE 1: Compliant
                'Structural/Concrete Strength': 35
            }
        },
        {
            elementId: 102,
            name: 'Column C-2',
            category: 'Structural Columns',
            properties: {
                'Identity Data/Type Name': 'C-2',
                // CASE 2: Non-Compliant
                'Structural/Concrete Strength': 25
            }
        }
    ];

    // 3. Evaluate
    console.log('⚙️  Evaluating 1 Req against 2 Elements...');
    const incidents = kernel.evaluate([mockReq], elements);

    // 4. Assert
    console.log(`📋 Incidents Found: ${incidents.length}`);

    incidents.forEach(inc => {
        console.log(`   🔴 INCIDENT: ${inc.elementName} - ${inc.description}`);
    });

    if (incidents.length === 1 && incidents[0].elementId === 102) {
        console.log('✅ PASS: Correctly identified the non-compliant element.');
    } else {
        console.error('❌ FAIL: Logic Error.');
        process.exit(1);
    }
}

testKernel();
