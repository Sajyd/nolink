/**
 * Composant Vue 3 pour le bouton Accès immédiat Nolink
 */

import { defineComponent, ref, onMounted, onUnmounted, h } from "vue";
import { showAccessButton } from "./index";

/**
 * Bouton "Accès immédiat" pour Vue 3
 */
export const NolinkAccessButton = defineComponent({
  name: "NolinkAccessButton",
  props: {
    serviceId: { type: String, required: true },
    buttonText: String,
    planId: String,
    color: String,
  },
  setup(props) {
    const container = ref<HTMLElement | null>(null);
    let btn: HTMLButtonElement | null = null;

    onMounted(() => {
      if (!container.value) return;
      btn = showAccessButton(props.serviceId, {
        buttonText: props.buttonText,
        planId: props.planId,
        color: props.color ?? undefined,
        mountTarget: container.value,
      });
    });

    onUnmounted(() => {
      btn?.remove();
    });

    return () => h("div", { ref: container });
  },
});
