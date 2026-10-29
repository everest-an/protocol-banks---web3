import type { DocBlock } from "@/lib/docs/content"

/** Renders the structured docs content; every locale shares the same shapes. */
export function DocBody({ blocks }: { blocks: DocBlock[] }) {
  return (
    <div className="mt-10 space-y-5">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "p":
            return (
              <p key={index} className="max-w-[74ch] text-sm leading-relaxed text-[#6F6B64]">
                {block.text}
              </p>
            )
          case "h2":
            return (
              <h2 key={index} className="pt-6 text-xl font-semibold tracking-tight">
                {block.text}
              </h2>
            )
          case "h3":
            return (
              <h3 key={index} className="pt-3 text-base font-semibold">
                {block.text}
              </h3>
            )
          case "code":
            return (
              <pre
                key={index}
                className="overflow-x-auto rounded-lg border border-[#E4E2DD] bg-white p-5 font-mono text-xs leading-relaxed text-[#111111]"
              >
                <code>{block.code}</code>
              </pre>
            )
          case "list":
            return (
              <ul key={index} className="space-y-2">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex gap-2 text-sm leading-relaxed text-[#6F6B64]">
                    <span className="text-[#111111]">—</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )
          case "table":
            return (
              <div key={index} className="overflow-x-auto rounded-lg border border-[#E4E2DD] bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#E4E2DD] font-mono text-[11px] uppercase tracking-[0.06em] text-[#6F6B64]">
                    <tr>
                      {block.head.map((cell) => (
                        <th key={cell} className="px-4 py-3">
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-[#F0EEE9] last:border-0">
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className={cellIndex === 0 ? "px-4 py-3 font-mono text-xs" : "px-4 py-3 text-[#6F6B64]"}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case "note":
            return (
              <div key={index} className="rounded-lg border border-[#E4E2DD] bg-white p-4 text-sm leading-relaxed text-[#6F6B64]">
                <span className="font-medium text-[#111111]">Note · </span>
                {block.text}
              </div>
            )
          default:
            return null
        }
      })}
    </div>
  )
}
