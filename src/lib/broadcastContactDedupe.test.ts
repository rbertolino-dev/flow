import { describe, expect, it } from "vitest";
import { dedupeBroadcastContactsByPhone } from "@/lib/broadcastContactDedupe";

describe("dedupeBroadcastContactsByPhone", () => {
  it("keeps first occurrence of the same digits", () => {
    const { contacts, removedCount, duplicatePhones } = dedupeBroadcastContactsByPhone([
      { phone: "+5521970601146", name: "A" },
      { phone: "55 21 97060-1146", name: "B" },
      { phone: "5521966168078", name: "C" },
    ]);
    expect(removedCount).toBe(1);
    expect(contacts).toHaveLength(2);
    expect(contacts[0].name).toBe("A");
    expect(duplicatePhones).toEqual(["5521970601146"]);
  });

  it("returns empty when all phones invalid", () => {
    const r = dedupeBroadcastContactsByPhone([{ phone: "" }, { phone: "abc" }]);
    expect(r.contacts).toHaveLength(0);
  });
});
