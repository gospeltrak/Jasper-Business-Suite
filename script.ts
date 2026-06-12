import fs from 'fs';
let content = fs.readFileSync('src/components/SuperSaaSAdminView.tsx', 'utf8');

const startStr = "{/* ======================= TAB 5: AFFILIATE ADS MANAGER ======================= */}";
const startIdx = content.indexOf(startStr);
const endStr = "{/* ======================= PERSISTENT LIVE OPERATIONS AUDIT LOGS ======================= */}";
const endIdx = content.indexOf(endStr);

const replacement = `{/* ======================= TAB 5: EXPENSES ======================= */}
        {activeTab === 'expenses' && (
          <div className="space-y-6 animate-fade-in text-left">
            <SaaSExpensesView />
          </div>
        )}

      </div>

      `;

if (startIdx !== -1 && endIdx !== -1) {
  const newContent = content.substring(0, startIdx) + replacement + content.substring(endIdx);
  fs.writeFileSync('src/components/SuperSaaSAdminView.tsx', newContent);
  console.log("Successfully replaced block.");
} else {
  console.log("Could not find boundaries.");
}
