const uploadForm = document.getElementById("uploadForm");
const uploadStatus = document.getElementById("uploadStatus");

function showStatus(message, tone = "info") {
  uploadStatus.style.display = "block";
  uploadStatus.textContent = message;
  uploadStatus.style.background = tone === "error" ? "#fee2e2" : "#f1f5f9";
  uploadStatus.style.color = tone === "error" ? "#991b1b" : "#475569";
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(uploadForm);

  try {
    const response = await fetch("/v1/tools/upload", {
      method: "POST",
      body: formData
    });
    const data = await response.json();
    if (!response.ok) {
      const message = data?.error?.message || "Upload failed.";
      showStatus(message, "error");
      return;
    }
    showStatus(
      `Upload complete. View your tool at /tools/${encodeURIComponent(data.id)}.`
    );
    uploadForm.reset();
  } catch (error) {
    showStatus("Upload failed. Please try again.", "error");
  }
});
